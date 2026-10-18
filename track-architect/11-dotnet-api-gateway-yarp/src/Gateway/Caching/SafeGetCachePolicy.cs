using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Caching;

/// <summary>
/// Output-caching policy for safe GETs. The built-in default policy refuses requests carrying Authorization, which would
/// disable caching for every authenticated API; this policy opts in explicitly but varies the cache key by the caller's
/// identity, host and full query string, so one user can never be served another user's response.
/// Only 200 responses without Set-Cookie are stored.
/// </summary>
public sealed class SafeGetCachePolicy(IOptionsMonitor<GatewayOptions> options) : IOutputCachePolicy
{
    public const string Name = "safe-get";

    public ValueTask CacheRequestAsync(OutputCacheContext context, CancellationToken cancellationToken)
    {
        var cache = options.CurrentValue.Cache;
        var http = context.HttpContext;
        var enabled = cache.Enabled && HttpMethods.IsGet(http.Request.Method);

        context.EnableOutputCaching = enabled;
        context.AllowCacheLookup = enabled;
        context.AllowCacheStorage = enabled;
        context.AllowLocking = true;
        context.ResponseExpirationTimeSpan = TimeSpan.FromSeconds(cache.TtlSeconds);
        context.CacheVaryByRules.VaryByHost = true;
        context.CacheVaryByRules.QueryKeys = "*";
        context.CacheVaryByRules.VaryByValues["identity"] = http.User.Subject() ?? "anonymous";
        return ValueTask.CompletedTask;
    }

    public ValueTask ServeFromCacheAsync(OutputCacheContext context, CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask ServeResponseAsync(OutputCacheContext context, CancellationToken cancellationToken)
    {
        var response = context.HttpContext.Response;
        context.AllowCacheStorage = response.StatusCode == StatusCodes.Status200OK && !response.Headers.ContainsKey("Set-Cookie");
        return ValueTask.CompletedTask;
    }
}
