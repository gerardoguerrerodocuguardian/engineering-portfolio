using System.Globalization;
using AdFlow.Gateway.Infrastructure;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Security;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

/// <summary>Daily quota per API-key client. Runs after authorization, so only accepted requests consume quota.</summary>
public sealed class ApiKeyQuotaMiddleware(
    RequestDelegate next,
    IQuotaStore quotas,
    IOptionsMonitor<GatewayOptions> options,
    TimeProvider time)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var principal = ctx.User;
        var clientId = principal.FindFirst(GatewayClaims.ClientId)?.Value;
        if (clientId is null || principal.FindFirst(GatewayClaims.AuthMethod)?.Value != "api_key")
        {
            return next(ctx);
        }

        var client = options.CurrentValue.ApiKeys.Clients.FirstOrDefault(c => c.Id == clientId);
        if (client is null)
        {
            return next(ctx);
        }

        var result = quotas.Consume(clientId, client.DailyQuota);
        ctx.Response.OnStarting(() =>
        {
            ctx.Response.Headers["X-Quota-Limit"] = result.Limit.ToString(CultureInfo.InvariantCulture);
            ctx.Response.Headers["X-Quota-Remaining"] = result.Remaining.ToString(CultureInfo.InvariantCulture);
            return Task.CompletedTask;
        });

        if (result.Allowed)
        {
            return next(ctx);
        }

        ctx.Items[GatewayItems.SkipAbuse] = true; // exhausting a legitimate quota is not an attack
        var retry = (int)Math.Max(1, Math.Ceiling((result.ResetAt - time.GetUtcNow()).TotalSeconds));
        return Reject.WriteAsync(ctx, StatusCodes.Status429TooManyRequests, "quota_exhausted", "Daily quota exhausted.", "quota_exhausted", retry);
    }
}
