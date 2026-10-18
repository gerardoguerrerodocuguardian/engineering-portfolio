using System.Diagnostics;
using AdFlow.Gateway.Infrastructure;

namespace AdFlow.Gateway.Middleware;

/// <summary>
/// W3C trace context. Honours an incoming (valid) traceparent, otherwise starts a new trace, exposes the trace id
/// as X-Correlation-Id and pushes it into the logging scope. Outgoing propagation is done by a YARP request transform.
/// </summary>
public sealed class CorrelationMiddleware(RequestDelegate next, ILogger<CorrelationMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var activity = Activity.Current;
        Activity? owned = null;
        if (activity is null)
        {
            owned = new Activity("gateway.request");
            var incoming = ctx.Request.Headers["traceparent"].ToString();
            if (incoming.Length > 0 && ActivityContext.TryParse(incoming, null, out _))
            {
                owned.SetParentId(incoming);
            }

            owned.Start();
            activity = owned;
        }

        var traceId = activity.TraceId.ToString();
        ctx.Response.OnStarting(() =>
        {
            ctx.Response.Headers[GatewayHeaders.CorrelationId] = traceId;
            return Task.CompletedTask;
        });

        var scope = new Dictionary<string, object>
        {
            ["TraceId"] = traceId,
            ["ClientIp"] = IpKey.Of(ctx.Connection.RemoteIpAddress),
        };
        using (logger.BeginScope(scope))
        {
            try
            {
                await next(ctx);
            }
            finally
            {
                owned?.Stop();
                owned?.Dispose();
            }
        }
    }
}
