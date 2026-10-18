using System.Diagnostics;
using System.Text.Json;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Audit;

public sealed record AuditEvent(
    DateTimeOffset Time,
    string Type,
    string? Ip,
    string? Subject,
    string? Method,
    string? Path,
    int? Status,
    string? Detail,
    string? TraceId)
{
    public static AuditEvent From(HttpContext ctx, string type, int? status = null, string? detail = null) => new(
        DateTimeOffset.UtcNow,
        type,
        IpKey.Of(ctx.Connection.RemoteIpAddress),
        ctx.User.Identity?.IsAuthenticated == true ? ctx.User.Subject() : null,
        ctx.Request.Method,
        ctx.Request.Path.Value,
        status,
        detail,
        Activity.Current?.TraceId.ToString());
}

public interface IAuditLog
{
    void Write(AuditEvent auditEvent);

    IReadOnlyList<AuditEvent> Recent(int take);
}

/// <summary>
/// Security audit trail, deliberately separate from request logs: category "AdFlow.Audit" for the log pipeline,
/// an optional JSON-lines file (its own sink), and an in-memory ring for the admin API.
/// A production deployment would ship this to an append-only store (SIEM / WORM bucket).
/// </summary>
public sealed class AuditLog(ILoggerFactory loggerFactory, IOptionsMonitor<GatewayOptions> options) : IAuditLog
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly ILogger _logger = loggerFactory.CreateLogger("AdFlow.Audit");
    private readonly Queue<AuditEvent> _ring = new();
    private readonly object _gate = new();

    public void Write(AuditEvent auditEvent)
    {
        _logger.LogWarning(
            "audit {AuditType} ip={Ip} subject={Subject} {Method} {Path} status={Status} detail={Detail}",
            auditEvent.Type, auditEvent.Ip, auditEvent.Subject, auditEvent.Method, auditEvent.Path, auditEvent.Status, auditEvent.Detail);

        var audit = options.CurrentValue.Audit;
        lock (_gate)
        {
            _ring.Enqueue(auditEvent);
            while (_ring.Count > Math.Max(1, audit.RingSize))
            {
                _ring.Dequeue();
            }

            if (!string.IsNullOrWhiteSpace(audit.FilePath))
            {
                try
                {
                    var dir = Path.GetDirectoryName(Path.GetFullPath(audit.FilePath));
                    if (!string.IsNullOrEmpty(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    File.AppendAllText(audit.FilePath, JsonSerializer.Serialize(auditEvent, Json) + Environment.NewLine);
                }
                catch (IOException ex)
                {
                    _logger.LogError(ex, "Audit file sink failed");
                }
                catch (UnauthorizedAccessException ex)
                {
                    _logger.LogError(ex, "Audit file sink failed");
                }
            }
        }
    }

    public IReadOnlyList<AuditEvent> Recent(int take)
    {
        lock (_gate)
        {
            return _ring.Reverse().Take(Math.Clamp(take, 1, 500)).ToList();
        }
    }
}
