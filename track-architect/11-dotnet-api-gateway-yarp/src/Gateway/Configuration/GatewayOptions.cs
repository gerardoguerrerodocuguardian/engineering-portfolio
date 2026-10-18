namespace AdFlow.Gateway.Configuration;

/// <summary>
/// Every feature is toggled and tuned here (section "Gateway"). Array defaults live in appsettings.json,
/// because the configuration binder appends to (rather than replaces) pre-populated collections.
/// </summary>
public sealed class GatewayOptions
{
    public const string Section = "Gateway";

    public AuthOptions Auth { get; set; } = new();
    public RateLimitOptions RateLimit { get; set; } = new();
    public AbuseOptions Abuse { get; set; } = new();
    public ValidationOptions Validation { get; set; } = new();
    public IpFilterOptions IpFilter { get; set; } = new();
    public HttpsOptions Https { get; set; } = new();
    public ForwardedOptions Forwarded { get; set; } = new();
    public ApiKeyOptions ApiKeys { get; set; } = new();
    public CacheOptions Cache { get; set; } = new();
    public WafOptions Waf { get; set; } = new();
    public ResilienceOptions Resilience { get; set; } = new();
    public TimeoutOptions Timeouts { get; set; } = new();
    public AuditOptions Audit { get; set; } = new();
}

public sealed class AuthOptions
{
    public string Issuer { get; set; } = "https://gateway.adflow.example";
    public string Audience { get; set; } = "adflow-api";
    /// <summary>OIDC authority. When set, signing keys come from its JWKS and dev tokens are disabled.</summary>
    public string Authority { get; set; } = "";
    /// <summary>Base64 HS256 key (>= 32 bytes) for dev tokens. Empty = random key generated at startup.</summary>
    public string SigningKey { get; set; } = "";
    public int ClockSkewSeconds { get; set; } = 30;
    public DevTokenOptions DevTokens { get; set; } = new();
}

public sealed class DevTokenOptions
{
    public bool Enabled { get; set; }
    public int LifetimeMinutes { get; set; } = 15;
}

public sealed class RateLimitOptions
{
    public bool Enabled { get; set; } = true;
    public int IpPermitLimit { get; set; } = 300;
    public int IpWindowSeconds { get; set; } = 60;
    public int IpSegments { get; set; } = 6;
    public int ClientTokenLimit { get; set; } = 60;
    public int ClientTokensPerPeriod { get; set; } = 30;
    public int ClientReplenishSeconds { get; set; } = 10;
    public int ConcurrencyLimit { get; set; } = 4;
    public int DefaultRetryAfterSeconds { get; set; } = 5;
}

public sealed class AbuseOptions
{
    public bool Enabled { get; set; } = true;
    public int FailureThreshold { get; set; } = 10;
    public int WindowSeconds { get; set; } = 60;
    public int BanSeconds { get; set; } = 300;
    public int[] CountStatusCodes { get; set; } = [];
}

public sealed class ValidationOptions
{
    public bool Enabled { get; set; } = true;
    public long MaxBodyBytes { get; set; } = 1_048_576;
    public int MaxPathLength { get; set; } = 2048;
    public int MaxQueryLength { get; set; } = 4096;
    public int MaxHeaderCount { get; set; } = 64;
    public int MaxHeaderValueLength { get; set; } = 8192;
    public string[] AllowedMethods { get; set; } = [];
    public string[] StripHeaders { get; set; } = [];
    public string[] StripHeaderPrefixes { get; set; } = [];
}

public sealed class IpFilterOptions
{
    public bool Enabled { get; set; } = true;
    public string[] Deny { get; set; } = [];
    /// <summary>Optional global allowlist. Empty means everyone not denied is allowed.</summary>
    public string[] Allow { get; set; } = [];
    public string AdminPathPrefix { get; set; } = "/admin";
    public string[] AdminAllow { get; set; } = [];
}

public sealed class HttpsOptions
{
    public bool RedirectToHttps { get; set; }
    public int HttpsPort { get; set; } = 8443;
    public bool Hsts { get; set; }
    public int HstsMaxAgeDays { get; set; } = 365;
}

public sealed class ForwardedOptions
{
    public string[] KnownProxies { get; set; } = [];
    public string[] KnownNetworks { get; set; } = [];
    public int ForwardLimit { get; set; } = 1;
}

public sealed class ApiKeyOptions
{
    public bool Enabled { get; set; } = true;
    public List<ApiClient> Clients { get; set; } = [];
}

public sealed class ApiClient
{
    public string Id { get; set; } = "";
    /// <summary>Lower-case hex SHA-256 of the full key (more than one allows rotation).</summary>
    public string[] KeyHashes { get; set; } = [];
    public string[] Scopes { get; set; } = [];
    public int DailyQuota { get; set; } = 1000;
}

public sealed class CacheOptions
{
    public bool Enabled { get; set; } = true;
    public int TtlSeconds { get; set; } = 5;
}

public enum WafMode
{
    Off,
    Detect,
    Block,
}

public sealed class WafOptions
{
    public WafMode Mode { get; set; } = WafMode.Detect;
    public bool InspectBody { get; set; } = true;
    public int MaxInspectBytes { get; set; } = 16_384;
}

public sealed class ResilienceOptions
{
    public bool Enabled { get; set; } = true;
    public int RetryCount { get; set; } = 2;
    public int BaseDelayMs { get; set; } = 100;
    public double BreakerFailureRatio { get; set; } = 0.5;
    public int BreakerMinThroughput { get; set; } = 8;
    public int BreakerSamplingSeconds { get; set; } = 30;
    public int BreakerBreakSeconds { get; set; } = 15;
}

public sealed class TimeoutOptions
{
    public int DefaultSeconds { get; set; } = 15;
    public int ReportsSeconds { get; set; } = 30;
}

public sealed class AuditOptions
{
    /// <summary>Optional JSON-lines file; empty disables the file sink (in-memory ring + logger remain).</summary>
    public string FilePath { get; set; } = "";
    public int RingSize { get; set; } = 500;
}
