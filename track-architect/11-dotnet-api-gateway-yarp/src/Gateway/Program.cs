using System.Diagnostics;
using AdFlow.Gateway.Abuse;
using AdFlow.Gateway.Audit;
using AdFlow.Gateway.Caching;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Endpoints;
using AdFlow.Gateway.Infrastructure;
using AdFlow.Gateway.Middleware;
using AdFlow.Gateway.Proxy;
using AdFlow.Gateway.RateLimiting;
using AdFlow.Gateway.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.Extensions.Options;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Yarp.ReverseProxy.Forwarder;
using Yarp.ReverseProxy.Transforms;

// W3C trace context everywhere (traceparent), regardless of the runtime default.
Activity.DefaultIdFormat = ActivityIdFormat.W3C;
Activity.ForceDefaultIdFormat = true;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddJsonConsole(o =>
{
    o.IncludeScopes = true;
    o.UseUtcTimestamp = true;
    o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ ";
});

builder.WebHost.ConfigureKestrel(k =>
{
    k.AddServerHeader = false;
    k.Limits.MaxRequestBodySize = 1_048_576;
    k.Limits.MaxRequestHeaderCount = 100;
    k.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    k.Limits.MaxRequestLineSize = 8 * 1024;
    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
});

var services = builder.Services;
services.AddOptions<GatewayOptions>().Bind(builder.Configuration.GetSection(GatewayOptions.Section));

services.AddSingleton(TimeProvider.System);
services.AddSingleton<GatewayMetrics>();
services.AddSingleton<IpPolicy>();
services.AddSingleton<IAuditLog, AuditLog>();
services.AddSingleton<IAbuseStore, InMemoryAbuseStore>(); // swap for a Redis-backed IAbuseStore when running replicas
services.AddSingleton<AbuseTracker>();
services.AddSingleton<IQuotaStore, InMemoryQuotaStore>();
services.AddSingleton<SigningKeyProvider>();
services.AddSingleton<DevTokenService>();

// Step 2: authentication (JWT bearer or API key, chosen by the presence of X-Api-Key).
services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureJwtBearer>();
services.AddAuthentication("Smart")
    .AddPolicyScheme("Smart", "Bearer or API key", o =>
        o.ForwardDefaultSelector = ctx => ctx.Request.Headers.ContainsKey(GatewayHeaders.ApiKey)
            ? ApiKeyDefaults.Scheme
            : JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer()
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyDefaults.Scheme, _ => { });

// Step 3: authorization policies referenced by YARP routes (AuthorizationPolicy). Everything else is denied by default.
services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPolicy("campaigns-read", p => p.RequireAuthenticatedUser().RequireAssertion(c => c.User.HasScope("campaigns.read")))
    .AddPolicy("campaigns-write", p => p.RequireRole("campaign-manager", "admin").RequireAssertion(c => c.User.HasScope("campaigns.write")))
    .AddPolicy("reports-read", p => p.RequireRole("analyst", "admin").RequireAssertion(c => c.User.HasScope("reports.read")))
    .AddPolicy("admin", p => p.RequireRole("admin"));

// Step 4: rate limiting.
services.AddRateLimiter(_ => { });
services.AddOptions<RateLimiterOptions>().Configure<IOptionsMonitor<GatewayOptions>>(GatewayRateLimiting.Configure);

// Step 18: output caching (policy name referenced by YARP routes).
services.AddOutputCache();
services.AddSingleton<SafeGetCachePolicy>();
services.AddOptions<OutputCacheOptions>().Configure<SafeGetCachePolicy>((o, policy) => o.AddPolicy(SafeGetCachePolicy.Name, policy));

// Step 9: request timeouts (policy names referenced by YARP routes).
services.AddRequestTimeouts();
services.AddOptions<RequestTimeoutOptions>().Configure<IOptionsMonitor<GatewayOptions>>((o, gw) =>
{
    o.DefaultPolicy = new RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(gw.CurrentValue.Timeouts.DefaultSeconds),
        TimeoutStatusCode = StatusCodes.Status504GatewayTimeout,
    };
    o.AddPolicy("reports", new RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(gw.CurrentValue.Timeouts.ReportsSeconds),
        TimeoutStatusCode = StatusCodes.Status504GatewayTimeout,
    });
});

// Step 7: forwarded headers only from known proxies, HSTS, HTTPS redirection.
services.AddOptions<ForwardedHeadersOptions>().Configure<IOptionsMonitor<GatewayOptions>>((o, gw) =>
{
    var f = gw.CurrentValue.Forwarded;
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    o.ForwardLimit = f.ForwardLimit;
    if (f.KnownProxies.Length > 0 || f.KnownNetworks.Length > 0)
    {
        o.KnownProxies.Clear();
        o.KnownNetworks.Clear();
        foreach (var proxy in f.KnownProxies)
        {
            o.KnownProxies.Add(System.Net.IPAddress.Parse(proxy));
        }

        foreach (var cidr in f.KnownNetworks)
        {
            var parts = cidr.Split('/');
            o.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse(parts[0]), int.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture)));
        }
    }
});
services.AddOptions<HstsOptions>().Configure<IOptionsMonitor<GatewayOptions>>((o, gw) =>
{
    o.MaxAge = TimeSpan.FromDays(gw.CurrentValue.Https.HstsMaxAgeDays);
    o.IncludeSubDomains = true;
    o.ExcludedHosts.Clear(); // the default excludes localhost; we want the header testable everywhere
});
services.AddOptions<HttpsRedirectionOptions>().Configure<IOptionsMonitor<GatewayOptions>>((o, gw) =>
    o.HttpsPort = gw.CurrentValue.Https.HttpsPort);

// Steps 1, 10, 13, 14, 16: YARP (routes/clusters from configuration) with our hardened, resilient HTTP client.
services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(transforms => transforms.AddRequestTransform(context =>
    {
        // Step 11: propagate W3C trace context downstream with the gateway's own span as parent.
        if (Activity.Current?.Id is { } traceparent)
        {
            context.ProxyRequest.Headers.Remove("traceparent");
            context.ProxyRequest.Headers.TryAddWithoutValidation("traceparent", traceparent);
        }

        return ValueTask.CompletedTask;
    }));
services.AddSingleton<IForwarderHttpClientFactory, GatewayForwarderHttpClientFactory>();

// Step 15: OpenTelemetry metrics (Prometheus scrape, admin only) and traces (OTLP when configured).
var otel = services.AddOpenTelemetry().ConfigureResource(r => r.AddService("adflow-gateway"));
otel.WithMetrics(m => m
    .AddAspNetCoreInstrumentation()
    .AddHttpClientInstrumentation()
    .AddMeter("Yarp.ReverseProxy", GatewayMetrics.MeterName)
    .AddPrometheusExporter(o => o.ScrapeEndpointPath = "/admin/metrics"));
otel.WithTracing(t =>
{
    t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation();
    if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
    {
        t.AddOtlpExporter();
    }
});

var app = builder.Build();
var gateway = () => app.Services.GetRequiredService<IOptionsMonitor<GatewayOptions>>().CurrentValue;

if (gateway().Auth.DevTokens.Enabled)
{
    app.Logger.LogWarning("Dev token endpoint is ENABLED (/dev/token). Never enable it on an internet-facing instance.");
}

if (gateway().Waf.Mode != WafMode.Block)
{
    app.Logger.LogWarning("WAF-lite mode is {Mode}; it is a teaching example, not a substitute for a real WAF.", gateway().Waf.Mode);
}

// Order matters; see docs/steps for why each layer sits where it does.
app.UseExceptionHandler(errors => errors.Run(ctx =>
    Reject.WriteAsync(ctx, StatusCodes.Status500InternalServerError, "internal_error", "Unexpected error.", "exception")));
app.UseForwardedHeaders();                               // 7  only trusted proxies may set client IP/proto
app.UseMiddleware<CorrelationMiddleware>();              // 11 traceparent / X-Correlation-Id
app.UseMiddleware<SecurityHeadersMiddleware>();          // 7  secure headers
app.UseWhen(_ => gateway().Https.Hsts, branch => branch.UseHsts());
app.UseWhen(_ => gateway().Https.RedirectToHttps, branch => branch.UseHttpsRedirection());
app.UseMiddleware<ObservabilityMiddleware>();            // 11, 12, 5  request log, audit, abuse feed
app.UseMiddleware<IpFilterMiddleware>();                 // 8  deny list / admin allowlist
app.UseMiddleware<BanMiddleware>();                      // 5  temporary bans
app.UseMiddleware<RequestValidationMiddleware>();        // 6  method, path, header and size limits
app.UseMiddleware<WafMiddleware>();                      // 20 signature inspection (teaching example)
app.UseRouting();
app.UseMiddleware<RouteLimitsMiddleware>();              // 6  per-route body size / content type
app.UseRequestTimeouts();                                // 9
app.UseAuthentication();                                 // 2
app.UseRateLimiter();                                    // 4  after authentication so limits can be per identity
app.UseAuthorization();                                  // 3
app.UseMiddleware<ApiKeyQuotaMiddleware>();              // 17
app.UseOutputCache();                                    // 18
app.UseMiddleware<IdentityHeadersMiddleware>();          // 6  strip spoofable headers, inject trusted identity
app.Use(async (ctx, next) =>                             // 15 metrics endpoint: admin role required (IP allowlist applied earlier)
{
    if (ctx.Request.Path.Equals("/admin/metrics", StringComparison.OrdinalIgnoreCase))
    {
        var authz = ctx.RequestServices.GetRequiredService<IAuthorizationService>();
        if (ctx.User.Identity?.IsAuthenticated != true)
        {
            await Reject.WriteAsync(ctx, StatusCodes.Status401Unauthorized, "unauthorized", "Authentication required.", "unauthenticated");
            return;
        }

        if (!(await authz.AuthorizeAsync(ctx.User, "admin")).Succeeded)
        {
            await Reject.WriteAsync(ctx, StatusCodes.Status403Forbidden, "forbidden", "Access denied.", "forbidden");
            return;
        }
    }

    await next();
});
app.UseOpenTelemetryPrometheusScrapingEndpoint();

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapDevToken();
app.MapAdmin();
app.MapReverseProxy();

app.Run();

/// <summary>Entry point type, public so WebApplicationFactory can host the gateway in tests.</summary>
public partial class Program
{
}
