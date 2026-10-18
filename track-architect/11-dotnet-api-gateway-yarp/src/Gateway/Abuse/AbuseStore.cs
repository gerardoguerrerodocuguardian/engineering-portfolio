using System.Collections.Concurrent;

namespace AdFlow.Gateway.Abuse;

public sealed record BanEntry(string Ip, DateTimeOffset BannedAt, DateTimeOffset ExpiresAt, string Reason);

/// <summary>
/// Storage seam for adaptive blocking. The in-memory implementation is per-instance; behind several gateway
/// replicas implement this on Redis (INCR + EXPIRE for the window, SET key EX for the ban) so bans are shared.
/// </summary>
public interface IAbuseStore
{
    /// <summary>Records one failure and returns how many failures the key has inside the window.</summary>
    int RecordFailure(string key, TimeSpan window);

    BanEntry? GetBan(string key);

    BanEntry Ban(string key, TimeSpan duration, string reason);

    bool Unban(string key);

    IReadOnlyList<BanEntry> ListBans();
}

public sealed class InMemoryAbuseStore(TimeProvider time) : IAbuseStore
{
    private const int MaxTrackedKeys = 100_000;

    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _failures = new();
    private readonly ConcurrentDictionary<string, BanEntry> _bans = new();

    public int RecordFailure(string key, TimeSpan window)
    {
        var now = time.GetUtcNow();
        if (_failures.Count > MaxTrackedKeys)
        {
            _failures.Clear(); // crude memory bound; a Redis store expires keys natively
        }

        var queue = _failures.GetOrAdd(key, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() > window)
            {
                queue.Dequeue();
            }

            queue.Enqueue(now);
            return queue.Count;
        }
    }

    public BanEntry? GetBan(string key)
    {
        if (!_bans.TryGetValue(key, out var ban))
        {
            return null;
        }

        if (ban.ExpiresAt > time.GetUtcNow())
        {
            return ban;
        }

        _bans.TryRemove(key, out _);
        return null;
    }

    public BanEntry Ban(string key, TimeSpan duration, string reason)
    {
        var now = time.GetUtcNow();
        var ban = new BanEntry(key, now, now + duration, reason);
        _bans[key] = ban;
        _failures.TryRemove(key, out _);
        return ban;
    }

    public bool Unban(string key)
    {
        _failures.TryRemove(key, out _);
        return _bans.TryRemove(key, out _);
    }

    public IReadOnlyList<BanEntry> ListBans()
    {
        var now = time.GetUtcNow();
        return _bans.Values.Where(b => b.ExpiresAt > now).OrderBy(b => b.ExpiresAt).ToList();
    }
}
