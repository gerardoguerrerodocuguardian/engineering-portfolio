using AdFlow.Gateway.Abuse;
using AdFlow.Gateway.Infrastructure;

namespace AdFlow.Gateway.Middleware;

/// <summary>Rejects requests from IPs with an active temporary ban (403 + Retry-After until the ban expires).</summary>
public sealed class BanMiddleware(RequestDelegate next, IAbuseStore store, TimeProvider time)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var ip = ctx.Connection.RemoteIpAddress;
        if (ip is not null && store.GetBan(IpKey.Of(ip)) is { } ban)
        {
            ctx.Items[GatewayItems.SkipAbuse] = true; // a banned client cannot extend its own ban by retrying
            var seconds = (int)Math.Max(1, Math.Ceiling((ban.ExpiresAt - time.GetUtcNow()).TotalSeconds));
            return Reject.WriteAsync(
                ctx, StatusCodes.Status403Forbidden, "temporarily_blocked",
                "Too many rejected requests. Try again later.", "ip_banned", seconds);
        }

        return next(ctx);
    }
}
