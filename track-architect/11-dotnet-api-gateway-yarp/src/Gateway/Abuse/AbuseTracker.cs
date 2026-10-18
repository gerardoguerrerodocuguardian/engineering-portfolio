using System.Net;
using AdFlow.Gateway.Audit;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Abuse;

/// <summary>Counts rejected requests per IP and issues a temporary ban once the threshold is crossed.</summary>
public sealed class AbuseTracker(
    IAbuseStore store,
    IOptionsMonitor<GatewayOptions> options,
    IpPolicy ipPolicy,
    IAuditLog audit,
    GatewayMetrics metrics)
{
    public void RecordRejection(HttpContext ctx, int status)
    {
        var abuse = options.CurrentValue.Abuse;
        IPAddress? ip = ctx.Connection.RemoteIpAddress;
        if (!abuse.Enabled || ip is null || ipPolicy.IsAdminAllowed(ip))
        {
            return; // admin networks are exempt so operators cannot lock themselves out
        }

        var key = IpKey.Of(ip);
        var count = store.RecordFailure(key, TimeSpan.FromSeconds(abuse.WindowSeconds));
        if (count < abuse.FailureThreshold || store.GetBan(key) is not null)
        {
            return;
        }

        var reason = $"{count} rejected requests in {abuse.WindowSeconds}s (last status {status})";
        var ban = store.Ban(key, TimeSpan.FromSeconds(abuse.BanSeconds), reason);
        metrics.Ban();
        audit.Write(AuditEvent.From(ctx, "ip_banned", status, $"{reason}; until {ban.ExpiresAt:O}"));
    }
}
