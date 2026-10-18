using System.Collections.Concurrent;
using System.Diagnostics.Metrics;

namespace AdFlow.Gateway.Infrastructure;

/// <summary>Custom OpenTelemetry-compatible metrics plus a small in-process snapshot for the admin stats endpoint.</summary>
public sealed class GatewayMetrics : IDisposable
{
    public const string MeterName = "AdFlow.Gateway";

    private readonly Meter _meter = new(MeterName);
    private readonly Counter<long> _rejected;
    private readonly Counter<long> _bans;
    private readonly Counter<long> _waf;
    private long _totalRejected;
    private long _totalBans;

    public GatewayMetrics()
    {
        _rejected = _meter.CreateCounter<long>("adflow.gateway.rejected", description: "Requests rejected by the gateway");
        _bans = _meter.CreateCounter<long>("adflow.gateway.bans", description: "IP bans issued");
        _waf = _meter.CreateCounter<long>("adflow.gateway.waf.matches", description: "WAF-lite signature matches");
    }

    public ConcurrentDictionary<string, long> ByReason { get; } = new();

    public long TotalRejected => Interlocked.Read(ref _totalRejected);

    public long TotalBans => Interlocked.Read(ref _totalBans);

    public void Rejected(string reason, int status)
    {
        Interlocked.Increment(ref _totalRejected);
        ByReason.AddOrUpdate(reason, 1, (_, v) => v + 1);
        _rejected.Add(1, new KeyValuePair<string, object?>("reason", reason), new KeyValuePair<string, object?>("status", status));
    }

    public void Ban()
    {
        Interlocked.Increment(ref _totalBans);
        _bans.Add(1);
    }

    public void WafMatch(string ruleId, string mode) =>
        _waf.Add(1, new KeyValuePair<string, object?>("rule", ruleId), new KeyValuePair<string, object?>("mode", mode));

    public void Dispose() => _meter.Dispose();
}
