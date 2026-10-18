using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

/// <summary>Deny list, optional global allow list, and an allow list for admin paths. All CIDR aware; fails closed.</summary>
public sealed class IpFilterMiddleware(RequestDelegate next, IpPolicy policy, IOptionsMonitor<GatewayOptions> options)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var filter = options.CurrentValue.IpFilter;
        if (!filter.Enabled)
        {
            return next(ctx);
        }

        var ip = ctx.Connection.RemoteIpAddress;
        if (policy.IsDenied(ip))
        {
            ctx.Items[GatewayItems.SkipAbuse] = true; // already blocked, do not feed the ban counter
            return Reject.WriteAsync(ctx, StatusCodes.Status403Forbidden, "forbidden", "Access denied.", "ip_denied");
        }

        if (!policy.IsAllowedGlobally(ip))
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status403Forbidden, "forbidden", "Access denied.", "ip_not_allowlisted");
        }

        if (ctx.Request.Path.StartsWithSegments(filter.AdminPathPrefix, StringComparison.OrdinalIgnoreCase) && !policy.IsAdminAllowed(ip))
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status403Forbidden, "forbidden", "Access denied.", "admin_ip_not_allowed");
        }

        return next(ctx);
    }
}
