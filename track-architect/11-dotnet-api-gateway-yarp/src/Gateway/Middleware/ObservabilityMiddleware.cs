using System.Diagnostics;
using AdFlow.Gateway.Abuse;
using AdFlow.Gateway.Audit;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

/// <summary>
/// Outermost "observer": writes one structured request log line, and turns every rejected response into an audit
/// event, a metric and (for configured status codes) an abuse-tracker strike. Components only have to set the
/// status/reason; they never log or count on their own.
/// </summary>
public sealed class ObservabilityMiddleware(
    RequestDelegate next,
    ILogger<ObservabilityMiddleware> logger,
    IAuditLog audit,
    AbuseTracker abuse,
    GatewayMetrics metrics,
    IOptionsMonitor<GatewayOptions> options)
{
    private static readonly HashSet<int> Audited = [400, 401, 403, 405, 413, 414, 415, 429, 431];

    public async Task InvokeAsync(HttpContext ctx)
    {
        var started = Stopwatch.GetTimestamp();
        var status = StatusCodes.Status500InternalServerError;
        try
        {
            await next(ctx);
            status = ctx.Response.StatusCode;
        }
        finally
        {
            var elapsed = Stopwatch.GetElapsedTime(started);
            logger.LogInformation(
                "request {Method} {Path} -> {Status} in {ElapsedMs:0.0} ms route={Route}",
                ctx.Request.Method, ctx.Request.Path.Value, status, elapsed.TotalMilliseconds, ctx.GetEndpoint()?.DisplayName);

            if (Audited.Contains(status))
            {
                var reason = ctx.Items.TryGetValue(GatewayItems.RejectReason, out var r) && r is string s ? s : $"status_{status}";
                metrics.Rejected(reason, status);
                audit.Write(AuditEvent.From(ctx, "access_rejected", status, reason));

                if (!ctx.Items.ContainsKey(GatewayItems.SkipAbuse) && options.CurrentValue.Abuse.CountStatusCodes.Contains(status))
                {
                    abuse.RecordRejection(ctx, status);
                }
            }
        }
    }
}
