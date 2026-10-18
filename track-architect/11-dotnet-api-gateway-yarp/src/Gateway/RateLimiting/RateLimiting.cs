using System.Globalization;
using System.Threading.RateLimiting;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.RateLimiting;

/// <summary>
/// Built-in ASP.NET Core rate limiter, configured from <see cref="GatewayOptions"/>:
/// a global per-IP sliding window (runs for every request), plus named policies referenced by YARP routes:
/// "client-bucket" (token bucket per user/API client) and "reports-concurrency" (concurrency limiter per client).
/// Limiter instances are created per partition on first use, so changed limits apply to new partitions only.
/// </summary>
public static class GatewayRateLimiting
{
    public const string ClientBucket = "client-bucket";
    public const string ReportsConcurrency = "reports-concurrency";

    public static void Configure(RateLimiterOptions limiter, IOptionsMonitor<GatewayOptions> gateway)
    {
        limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            var rl = gateway.CurrentValue.RateLimit;
            if (!rl.Enabled || ctx.Request.Path.StartsWithSegments("/healthz"))
            {
                return RateLimitPartition.GetNoLimiter("none");
            }

            return RateLimitPartition.GetSlidingWindowLimiter(
                "ip:" + IpKey.Of(ctx.Connection.RemoteIpAddress),
                _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = rl.IpPermitLimit,
                    Window = TimeSpan.FromSeconds(rl.IpWindowSeconds),
                    SegmentsPerWindow = Math.Max(1, rl.IpSegments),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                });
        });

        limiter.AddPolicy<string>(ClientBucket, ctx =>
        {
            var rl = gateway.CurrentValue.RateLimit;
            if (!rl.Enabled)
            {
                return RateLimitPartition.GetNoLimiter("none");
            }

            return RateLimitPartition.GetTokenBucketLimiter(
                ClientKey(ctx),
                _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = rl.ClientTokenLimit,
                    TokensPerPeriod = rl.ClientTokensPerPeriod,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(rl.ClientReplenishSeconds),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                });
        });

        limiter.AddPolicy<string>(ReportsConcurrency, ctx =>
        {
            var rl = gateway.CurrentValue.RateLimit;
            if (!rl.Enabled)
            {
                return RateLimitPartition.GetNoLimiter("none");
            }

            return RateLimitPartition.GetConcurrencyLimiter(
                ClientKey(ctx),
                _ => new ConcurrencyLimiterOptions { PermitLimit = rl.ConcurrencyLimit, QueueLimit = 0 });
        });

        limiter.OnRejected = async (context, _) =>
        {
            var rl = gateway.CurrentValue.RateLimit;
            var retry = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var after)
                ? (int)Math.Ceiling(after.TotalSeconds)
                : rl.DefaultRetryAfterSeconds;
            retry = Math.Max(1, retry);
            await Reject.WriteAsync(
                context.HttpContext, StatusCodes.Status429TooManyRequests, "rate_limited",
                "Too many requests. Retry after " + retry.ToString(CultureInfo.InvariantCulture) + "s.", "rate_limited", retry);
        };
    }

    /// <summary>Authenticated callers are limited per identity (user or API client); anonymous ones per IP.</summary>
    public static string ClientKey(HttpContext ctx) =>
        ctx.User.Identity?.IsAuthenticated == true
            ? "sub:" + (ctx.User.Subject() ?? "anonymous")
            : "ip:" + IpKey.Of(ctx.Connection.RemoteIpAddress);
}
