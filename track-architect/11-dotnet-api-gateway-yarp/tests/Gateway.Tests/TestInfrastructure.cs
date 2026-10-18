using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using AdFlow.Gateway.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AdFlow.Gateway.Tests;

public sealed record RecordedRequest(string Method, string PathAndQuery, IReadOnlyDictionary<string, string> Headers);

/// <summary>
/// In-process downstream service on a real loopback Kestrel port. It is the "test double for downstream": it records
/// what the gateway sent, can be made slow, unhealthy or failing, and reports which instance served each request.
/// </summary>
public sealed class FakeBackend : IAsyncDisposable
{
    private readonly WebApplication _app;
    private bool _disposed;

    private FakeBackend(WebApplication app, string name, string address)
    {
        _app = app;
        Name = name;
        Address = address;
    }

    public string Name { get; }

    public string Address { get; }

    public bool Healthy { get; set; } = true;

    public bool FailAll { get; set; }

    public TimeSpan Delay { get; set; }

    public ConcurrentQueue<RecordedRequest> Requests { get; } = new();

    public RecordedRequest Last => Requests.Last();

    public static async Task<FakeBackend> StartAsync(string name)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        var app = builder.Build();

        FakeBackend? self = null;
        app.Run(async ctx =>
        {
            var backend = self!;
            if (ctx.Request.Path == "/healthz")
            {
                ctx.Response.StatusCode = backend.Healthy ? 200 : 503;
                return;
            }

            var headers = ctx.Request.Headers.ToDictionary(h => h.Key.ToLowerInvariant(), h => h.Value.ToString());
            backend.Requests.Enqueue(new RecordedRequest(ctx.Request.Method, (ctx.Request.Path.Value ?? "") + ctx.Request.QueryString.Value, headers));

            if (backend.Delay > TimeSpan.Zero)
            {
                await Task.Delay(backend.Delay, ctx.RequestAborted);
            }

            ctx.Response.Headers["X-Served-By"] = backend.Name;
            if (backend.FailAll)
            {
                ctx.Response.StatusCode = 500;
                return;
            }

            await ctx.Response.WriteAsJsonAsync(new { instance = backend.Name, path = ctx.Request.Path.Value });
        });

        await app.StartAsync();
        var address = app.Urls.First();
        self = new FakeBackend(app, name, address);
        return self;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await _app.StopAsync();
        await _app.DisposeAsync();
    }
}

/// <summary>Lets tests choose the caller's IP (TestServer has none) through the X-Test-Remote-Ip header.</summary>
internal sealed class RemoteIpStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (ctx, nextMiddleware) =>
        {
            if (ctx.Request.Headers.TryGetValue("X-Test-Remote-Ip", out var ip) && IPAddress.TryParse(ip.ToString(), out var parsed))
            {
                ctx.Connection.RemoteIpAddress = parsed;
            }

            await nextMiddleware();
        });
        next(app);
    };
}

public sealed class GatewayFactory(Dictionary<string, string?> settings) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(settings));
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, RemoteIpStartupFilter>());
    }
}

/// <summary>One gateway + two campaign instances + one reports instance, wired together per test.</summary>
public sealed class Harness : IAsyncDisposable
{
    private Harness(FakeBackend[] campaigns, FakeBackend reports, GatewayFactory factory)
    {
        Campaigns = campaigns;
        Reports = reports;
        Factory = factory;
    }

    public FakeBackend[] Campaigns { get; }

    public FakeBackend Reports { get; }

    public GatewayFactory Factory { get; }

    public static async Task<Harness> CreateAsync(Dictionary<string, string?>? overrides = null, int campaignInstances = 2)
    {
        var campaigns = new List<FakeBackend>();
        for (var i = 1; i <= campaignInstances; i++)
        {
            campaigns.Add(await FakeBackend.StartAsync($"campaigns-{i}"));
        }

        var reports = await FakeBackend.StartAsync("reports-1");

        var settings = new Dictionary<string, string?>
        {
            ["Gateway:Auth:DevTokens:Enabled"] = "true",
            ["Gateway:Resilience:BaseDelayMs"] = "5",
            ["Gateway:Cache:Enabled"] = "false",
            ["Gateway:RateLimit:IpPermitLimit"] = "100000",
            ["Gateway:RateLimit:ClientTokenLimit"] = "100000",
            ["Gateway:RateLimit:ClientTokensPerPeriod"] = "100000",
            ["ReverseProxy:Clusters:campaigns:Destinations:d1:Address"] = campaigns[0].Address,
            ["ReverseProxy:Clusters:campaigns:Destinations:d2:Address"] = campaigns[campaigns.Count > 1 ? 1 : 0].Address,
            ["ReverseProxy:Clusters:reports:Destinations:d1:Address"] = reports.Address,
            ["ReverseProxy:Clusters:campaigns:HealthCheck:Active:Enabled"] = "false",
            ["ReverseProxy:Clusters:reports:HealthCheck:Active:Enabled"] = "false",
        };
        if (overrides is not null)
        {
            foreach (var (key, value) in overrides)
            {
                settings[key] = value;
            }
        }

        return new Harness([.. campaigns], reports, new GatewayFactory(settings));
    }

    public string Token(string user) => Factory.Services.GetRequiredService<DevTokenService>().IssueFor(user);

    /// <summary>A client that appears to come from <paramref name="ip"/> and (optionally) carries a demo user's JWT.</summary>
    public HttpClient Client(string ip = "192.0.2.10", string? user = null)
    {
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("X-Test-Remote-Ip", ip);
        if (user is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token(user));
        }

        return client;
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        foreach (var backend in Campaigns)
        {
            await backend.DisposeAsync();
        }

        await Reports.DisposeAsync();
    }
}
