using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

/// <summary>Strips spoofable inbound headers and injects the identity the gateway itself established.</summary>
public sealed class IdentityHeadersMiddleware(RequestDelegate next, IOptionsMonitor<GatewayOptions> options)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var v = options.CurrentValue.Validation;
        var headers = ctx.Request.Headers;

        var doomed = headers.Keys
            .Where(k => v.StripHeaders.Contains(k, StringComparer.OrdinalIgnoreCase)
                        || v.StripHeaderPrefixes.Any(p => k.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        foreach (var name in doomed)
        {
            headers.Remove(name);
        }

        var user = ctx.User;
        if (user.Identity?.IsAuthenticated == true)
        {
            headers[GatewayHeaders.UserId] = user.Subject() ?? string.Empty;
            headers[GatewayHeaders.UserRoles] = string.Join(',', user.Roles());
            headers[GatewayHeaders.UserScopes] = string.Join(' ', user.Scopes());
            headers[GatewayHeaders.AuthMethod] = user.FindFirst(GatewayClaims.AuthMethod)?.Value ?? "jwt";
            if (user.FindFirst(GatewayClaims.ClientId)?.Value is { } clientId)
            {
                headers[GatewayHeaders.ClientId] = clientId;
            }
        }

        return next(ctx);
    }
}
