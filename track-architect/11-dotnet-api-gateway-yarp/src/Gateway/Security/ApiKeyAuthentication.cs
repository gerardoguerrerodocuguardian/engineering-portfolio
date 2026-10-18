using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Security;

public static class ApiKeyDefaults
{
    public const string Scheme = "ApiKey";
}

/// <summary>
/// Authenticates "X-Api-Key: &lt;clientId&gt;.&lt;secret&gt;" against SHA-256 hashes from configuration. Keys are
/// high-entropy random strings, so a plain fast hash is appropriate (unlike passwords); comparison is constant time.
/// </summary>
public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> schemeOptions,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptionsMonitor<GatewayOptions> gateway)
    : AuthenticationHandler<AuthenticationSchemeOptions>(schemeOptions, logger, encoder)
{
    public static string Hash(string key) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var options = gateway.CurrentValue.ApiKeys;
        if (!options.Enabled || !Request.Headers.TryGetValue(GatewayHeaders.ApiKey, out var header))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var key = header.ToString();
        var dot = key.IndexOf('.', StringComparison.Ordinal);
        if (dot <= 0)
        {
            return Task.FromResult(AuthenticateResult.Fail("Malformed API key."));
        }

        var client = options.Clients.FirstOrDefault(c => string.Equals(c.Id, key[..dot], StringComparison.Ordinal));
        var presented = Encoding.ASCII.GetBytes(Hash(key));
        var valid = client is not null && client.KeyHashes.Any(h =>
            CryptographicOperations.FixedTimeEquals(presented, Encoding.ASCII.GetBytes(h.ToLowerInvariant())));
        if (client is null || !valid)
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key."));
        }

        var claims = new List<Claim>
        {
            new(GatewayClaims.Subject, $"client:{client.Id}"),
            new(GatewayClaims.ClientId, client.Id),
            new(GatewayClaims.Role, "partner"),
            new(GatewayClaims.Scope, string.Join(' ', client.Scopes)),
            new(GatewayClaims.AuthMethod, "api_key"),
        };
        var identity = new ClaimsIdentity(claims, ApiKeyDefaults.Scheme, GatewayClaims.Subject, GatewayClaims.Role);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), ApiKeyDefaults.Scheme);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

public sealed record QuotaResult(bool Allowed, int Limit, int Remaining, DateTimeOffset ResetAt);

/// <summary>Daily per-client quota. In-memory here; use Redis (INCR + EXPIREAT) when running several replicas.</summary>
public interface IQuotaStore
{
    QuotaResult Consume(string clientId, int dailyLimit);
}

public sealed class InMemoryQuotaStore(TimeProvider time) : IQuotaStore
{
    private readonly ConcurrentDictionary<string, int> _counters = new();

    public QuotaResult Consume(string clientId, int dailyLimit)
    {
        var now = time.GetUtcNow();
        var day = now.UtcDateTime.Date;
        var reset = new DateTimeOffset(day.AddDays(1), TimeSpan.Zero);
        var key = $"{clientId}:{day:yyyyMMdd}";

        foreach (var stale in _counters.Keys.Where(k => !k.EndsWith($":{day:yyyyMMdd}", StringComparison.Ordinal)).ToList())
        {
            _counters.TryRemove(stale, out _);
        }

        var used = _counters.AddOrUpdate(key, 1, (_, v) => v + 1);
        return new QuotaResult(used <= dailyLimit, dailyLimit, Math.Max(0, dailyLimit - used), reset);
    }
}
