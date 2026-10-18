using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AdFlow.Gateway.Abuse;
using AdFlow.Gateway.Audit;
using Microsoft.Extensions.DependencyInjection;

namespace AdFlow.Gateway.Tests;

[Trait("Step", "04")]
public class RateLimitingTests
{
    [Fact]
    public async Task Token_bucket_returns_429_with_retry_after_once_the_bucket_is_empty()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:RateLimit:ClientTokenLimit"] = "2",
            ["Gateway:RateLimit:ClientTokensPerPeriod"] = "1",
            ["Gateway:RateLimit:ClientReplenishSeconds"] = "60",
        });
        using var client = h.Client(user: "alice");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/campaigns")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/campaigns")).StatusCode);
        var limited = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.True(limited.Headers.TryGetValues("Retry-After", out var values));
        Assert.True(int.Parse(values!.Single(), System.Globalization.CultureInfo.InvariantCulture) >= 1);
    }

    [Fact]
    public async Task Buckets_are_per_user_so_another_user_is_unaffected()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:RateLimit:ClientTokenLimit"] = "1",
            ["Gateway:RateLimit:ClientTokensPerPeriod"] = "1",
            ["Gateway:RateLimit:ClientReplenishSeconds"] = "60",
        });
        using var alice = h.Client(user: "alice");
        using var bob = h.Client(user: "bob");

        Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync("/api/v1/campaigns")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await alice.GetAsync("/api/v1/campaigns")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await bob.GetAsync("/api/v1/campaigns")).StatusCode);
    }

    [Fact]
    public async Task Per_ip_sliding_window_limits_even_unauthenticated_callers()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:RateLimit:IpPermitLimit"] = "3",
            ["Gateway:RateLimit:IpWindowSeconds"] = "60",
            ["Gateway:Abuse:Enabled"] = "false",
        });
        using var client = h.Client();

        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
        {
            codes.Add((await client.GetAsync("/api/v1/campaigns")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, codes[0]);
        Assert.Contains(HttpStatusCode.TooManyRequests, codes);
    }
}

[Trait("Step", "05")]
public class AbuseProtectionTests
{
    [Fact]
    public async Task Repeated_auth_failures_trigger_a_temporary_ban_that_admins_can_lift()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:Abuse:FailureThreshold"] = "3",
            ["Gateway:Abuse:BanSeconds"] = "120",
        });
        const string attacker = "198.51.100.50";
        using var bad = h.Client(attacker);
        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await bad.GetAsync("/api/v1/campaigns")).StatusCode);
        }

        // Even a perfectly valid token cannot be used from a banned address.
        using var banned = h.Client(attacker, "alice");
        var blocked = await banned.GetAsync("/api/v1/campaigns");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.True(blocked.Headers.Contains("Retry-After"));
        Assert.Contains(h.Factory.Services.GetRequiredService<IAbuseStore>().ListBans(), b => b.Ip == attacker);
        Assert.Contains(h.Factory.Services.GetRequiredService<IAuditLog>().Recent(50), e => e.Type == "ip_banned");

        // An operator on an allowlisted network lifts the ban.
        using var admin = h.Client("10.1.2.3", "root");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/admin/blocked/{attacker}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await banned.GetAsync("/api/v1/campaigns")).StatusCode);
    }

    [Fact]
    public async Task Bans_are_stored_with_an_expiry()
    {
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var clock = new MutableClock(now);
        var store = new InMemoryAbuseStore(clock);

        store.Ban("203.0.113.9", TimeSpan.FromMinutes(5), "test");
        Assert.NotNull(store.GetBan("203.0.113.9"));

        clock.Now = now.AddMinutes(6);
        Assert.Null(store.GetBan("203.0.113.9"));
        Assert.Empty(store.ListBans());
    }

    private sealed class MutableClock(DateTimeOffset start) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = start;

        public override DateTimeOffset GetUtcNow() => Now;
    }
}

[Trait("Step", "08")]
public class IpFilterTests
{
    [Fact]
    public async Task Denied_cidr_range_gets_403()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:IpFilter:Deny:0"] = "203.0.113.0/24" });
        using var denied = h.Client("203.0.113.77", "alice");
        using var allowed = h.Client("192.0.2.5", "alice");

        Assert.Equal(HttpStatusCode.Forbidden, (await denied.GetAsync("/api/v1/campaigns")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await allowed.GetAsync("/api/v1/campaigns")).StatusCode);
        Assert.All(h.Campaigns, b => Assert.DoesNotContain(b.Requests, r => r.Headers.GetValueOrDefault("x-test-remote-ip") == "203.0.113.77"));
    }

    [Fact]
    public async Task Admin_routes_are_blocked_for_non_allowlisted_ips_even_with_an_admin_token()
    {
        await using var h = await Harness.CreateAsync();
        using var outsider = h.Client("198.51.100.7", "root");
        using var insider = h.Client("10.1.2.3", "root");
        using var insiderNotAdmin = h.Client("10.1.2.3", "alice");

        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync("/admin/stats")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await insider.GetAsync("/admin/stats")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await insiderNotAdmin.GetAsync("/admin/stats")).StatusCode);
    }

    [Fact]
    [Trait("Step", "19")]
    public async Task Admin_changes_are_audited()
    {
        await using var h = await Harness.CreateAsync();
        using var admin = h.Client("10.1.2.3", "root");

        var ban = await admin.PostAsJsonAsync("/admin/blocked", new { ip = "198.51.100.99", minutes = 10, reason = "manual" });
        Assert.Equal(HttpStatusCode.OK, ban.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/admin/reload", null)).StatusCode);

        var types = h.Factory.Services.GetRequiredService<IAuditLog>().Recent(50).Select(e => e.Type).ToList();
        Assert.Contains("admin_ban", types);
        Assert.Contains("admin_reload", types);
    }
}

[Trait("Step", "17")]
public class ApiKeyTests
{
    private const string DemoKey = "orbit.demo-key-change-me";

    [Fact]
    public async Task Valid_key_is_accepted_and_quota_is_enforced_with_429_and_retry_after()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:ApiKeys:Clients:0:DailyQuota"] = "2" });
        using var client = h.Client();
        client.DefaultRequestHeaders.Add("X-Api-Key", DemoKey);

        var first = await client.GetAsync("/api/v1/campaigns");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("1", first.Headers.GetValues("X-Quota-Remaining").Single());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/campaigns")).StatusCode);

        var exhausted = await client.GetAsync("/api/v1/campaigns");
        Assert.Equal(HttpStatusCode.TooManyRequests, exhausted.StatusCode);
        Assert.True(exhausted.Headers.Contains("Retry-After"));
        Assert.Equal("0", exhausted.Headers.GetValues("X-Quota-Remaining").Single());
    }

    [Fact]
    public async Task Wrong_key_gets_401_and_key_holders_cannot_write()
    {
        await using var h = await Harness.CreateAsync();
        using var wrong = h.Client();
        wrong.DefaultRequestHeaders.Add("X-Api-Key", "orbit.not-the-key");
        Assert.Equal(HttpStatusCode.Unauthorized, (await wrong.GetAsync("/api/v1/campaigns")).StatusCode);

        using var partner = h.Client();
        partner.DefaultRequestHeaders.Add("X-Api-Key", DemoKey);
        var write = await partner.PostAsJsonAsync("/api/v1/campaigns", new { name = "x", dailyBudgetCents = 1 });
        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
    }

    [Fact]
    public async Task Api_key_is_not_forwarded_downstream_but_client_identity_is()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client();
        client.DefaultRequestHeaders.Add("X-Api-Key", DemoKey);

        await client.GetAsync("/api/v1/campaigns/echo");

        var seen = h.Campaigns.SelectMany(b => b.Requests).Single().Headers;
        Assert.False(seen.ContainsKey("x-api-key"));
        Assert.Equal("orbit", seen["x-client-id"]);
        Assert.Equal("api_key", seen["x-auth-method"]);
    }
}

[Trait("Step", "20")]
public class WafTests
{
    [Fact]
    public async Task Sql_injection_pattern_in_query_is_blocked_in_block_mode()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var attack = await client.GetAsync("/api/v1/campaigns?q=" + Uri.EscapeDataString("1' OR '1'='1"));
        var clean = await client.GetAsync("/api/v1/campaigns?q=sneakers");

        Assert.Equal(HttpStatusCode.Forbidden, attack.StatusCode);
        Assert.Equal(HttpStatusCode.OK, clean.StatusCode);
        Assert.DoesNotContain(h.Campaigns.SelectMany(b => b.Requests), r => r.PathAndQuery.Contains("OR", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Xss_in_json_body_is_blocked()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        // Raw JSON on purpose: System.Text.Json would escape '<' as \u003C, which this naive signature would not see.
        var body = new StringContent("{\"name\":\"<script>alert(1)</script>\",\"dailyBudgetCents\":1}", System.Text.Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/campaigns", body);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Detect_mode_logs_but_does_not_block()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:Waf:Mode"] = "Detect" });
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/api/v1/campaigns?q=" + Uri.EscapeDataString("<script>alert(1)</script>"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(h.Factory.Services.GetRequiredService<IAuditLog>().Recent(50), e => e.Type == "waf_detect");
    }

    [Theory]
    [InlineData("union select password from users", "SQLI-001")]
    [InlineData("x; DROP TABLE campaigns", "SQLI-003")]
    [InlineData("<img src=x onerror=alert(1)>", "XSS-002")]
    [InlineData("../../etc/passwd", "TRAV-001")]
    public void Signatures_match_known_patterns(string input, string ruleId) =>
        Assert.Equal(ruleId, Middleware.WafSignatures.Inspect(input)?.RuleId);

    [Theory]
    [InlineData("summer sneakers")]
    [InlineData("O'Brien and sons")]
    public void Signatures_ignore_ordinary_text(string input) =>
        Assert.Null(Middleware.WafSignatures.Inspect(input));
}
