using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

namespace AdFlow.Gateway.Infrastructure;

/// <summary>One place that writes a rejection: status, optional Retry-After, JSON body, and the reason that the
/// observability middleware later turns into an audit event and a metric.</summary>
public static class Reject
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record Body(string Error, string Detail, string? TraceId);

    public static Task WriteAsync(HttpContext ctx, int status, string error, string detail, string reason, int? retryAfterSeconds = null)
    {
        ctx.Items[GatewayItems.RejectReason] = reason;
        if (ctx.Response.HasStarted)
        {
            return Task.CompletedTask;
        }

        ctx.Response.StatusCode = status;
        if (retryAfterSeconds is { } seconds)
        {
            ctx.Response.Headers["Retry-After"] = seconds.ToString(CultureInfo.InvariantCulture);
        }

        var traceId = Activity.Current?.TraceId.ToString();
        return ctx.Response.WriteAsJsonAsync(new Body(error, detail, traceId), Json, "application/problem+json");
    }
}
