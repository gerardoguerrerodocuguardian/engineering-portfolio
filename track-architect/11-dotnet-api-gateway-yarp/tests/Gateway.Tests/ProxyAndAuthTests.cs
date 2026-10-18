using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using AdFlow.Gateway.Security;
using Microsoft.Extensions.DependencyInjection;

namespace AdFlow.Gateway.Tests;

[Trait("Step", "01")]
public class ReverseProxyTests
{
    [Fact]
    public async Task Authorized_request_is_proxied_to_the_internal_service_with_the_prefix_removed()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var served = h.Campaigns.SelectMany(b => b.Requests).Single();
        Assert.Equal("/campaigns", served.PathAndQuery);
    }

    [Fact]
    public async Task Unknown_routes_are_not_proxied()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/internal/secrets");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }
}

[Trait("Step", "02")]
public class AuthenticationTests
{
    [Fact]
    public async Task Request_without_token_gets_401()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client();

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }

    [Fact]
    public async Task Garbage_token_gets_401()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not.a.jwt");

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Expired_token_gets_401()
    {
        await using var h = await Harness.CreateAsync();
        var tokens = h.Factory.Services.GetRequiredService<DevTokenService>();
        using var client = h.Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", tokens.IssueFor("alice", TimeSpan.FromMinutes(-10)));

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Token_for_another_audience_gets_401()
    {
        await using var h = await Harness.CreateAsync();
        var tokens = h.Factory.Services.GetRequiredService<DevTokenService>();
        using var client = h.Client();
        var token = tokens.Issue("alice", ["campaign-manager"], ["campaigns.read"], TimeSpan.FromMinutes(5), audience: "some-other-api");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Dev_token_endpoint_issues_a_working_token()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client();

        var issued = await client.PostAsJsonAsync("/dev/token", new { user = "alice" });
        Assert.Equal(HttpStatusCode.OK, issued.StatusCode);
        var body = await issued.Content.ReadFromJsonAsync<Dictionary<string, System.Text.Json.JsonElement>>();
        var token = body!["access_token"].GetString()!;

        using var authed = h.Client();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.OK, (await authed.GetAsync("/api/v1/campaigns")).StatusCode);
    }

    [Fact]
    public async Task Dev_token_endpoint_is_hidden_when_disabled()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:Auth:DevTokens:Enabled"] = "false" });
        using var client = h.Client();

        var response = await client.PostAsJsonAsync("/dev/token", new { user = "alice" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

[Trait("Step", "03")]
public class AuthorizationTests
{
    [Fact]
    public async Task Analyst_cannot_write_campaigns_403()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "bob");

        var response = await client.PostAsync("/api/v1/campaigns",
            new StringContent("""{"name":"x","dailyBudgetCents":100}""", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }

    [Fact]
    public async Task Campaign_manager_without_reports_scope_cannot_read_reports_403()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/api/v1/reports/summary");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(h.Reports.Requests);
    }

    [Fact]
    public async Task Right_role_and_scope_is_allowed()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "bob");

        var response = await client.GetAsync("/api/v1/reports/summary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Role_without_matching_scope_is_denied()
    {
        await using var h = await Harness.CreateAsync();
        var tokens = h.Factory.Services.GetRequiredService<DevTokenService>();
        using var client = h.Client();
        var token = tokens.Issue("carol", ["campaign-manager"], ["campaigns.read"], TimeSpan.FromMinutes(5));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/api/v1/campaigns",
            new StringContent("""{"name":"x","dailyBudgetCents":100}""", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode); // role ok, scope campaigns.write missing
    }
}

[Trait("Step", "06")]
public class RequestValidationTests
{
    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    [Fact]
    public async Task Oversized_body_gets_413_and_never_reaches_the_service()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");
        var big = "{\"name\":\"" + new string('a', 70_000) + "\"}";

        var response = await client.PostAsync("/api/v1/campaigns", Json(big));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }

    [Fact]
    public async Task Wrong_content_type_gets_415()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.PostAsync("/api/v1/campaigns", new StringContent("name=x", Encoding.UTF8, "text/plain"));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/v1/campaigns/%252e%252e/admin")] // double-encoded dot segments
    [InlineData("/api/v1/campaigns/a%5cb")]            // backslash
    public async Task Suspicious_paths_are_rejected_with_400(string path)
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }

    [Fact]
    public async Task Nul_byte_in_path_never_reaches_a_downstream_service()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        // Like Kestrel, the in-memory TestServer refuses a decoded NUL byte before any middleware runs
        // (it throws instead of returning a status), so the property under test is "nothing was forwarded".
        try
        {
            var response = await client.GetAsync("/api/v1/campaigns/a%00b");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        catch (InvalidOperationException)
        {
            // expected with TestServer
        }

        Assert.All(h.Campaigns, b => Assert.Empty(b.Requests));
    }

    [Theory]
    [InlineData("/api/v1/campaigns", false)]
    [InlineData("/api/v1/campaigns/cmp-1001", false)]
    [InlineData("/api/v1/../admin", true)]
    [InlineData("/api/v1/%2e%2e/admin", true)]
    [InlineData("/a//b", true)]
    [InlineData("/a\\b", true)]
    public void Path_safety_rules(string path, bool unsafePath) =>
        Assert.Equal(unsafePath, Middleware.PathSafety.IsUnsafe(path));

    [Fact]
    public async Task Trace_method_is_not_allowed_405()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Trace, "/api/v1/campaigns"));

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    [Fact]
    public async Task Spoofed_identity_and_forwarding_headers_are_stripped_and_trusted_ones_injected()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/campaigns/echo");
        request.Headers.Add("X-User-Id", "root");
        request.Headers.Add("X-User-Roles", "admin");
        request.Headers.Add("X-Client-Id", "evil");
        request.Headers.Add("X-Forwarded-For", "6.6.6.6");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seen = h.Campaigns.SelectMany(b => b.Requests).Single().Headers;
        Assert.Equal("alice", seen["x-user-id"]);
        Assert.Equal("campaign-manager", seen["x-user-roles"]);
        Assert.False(seen.ContainsKey("x-client-id"));
        Assert.False(seen.TryGetValue("x-forwarded-for", out var xff) && xff.Contains("6.6.6.6", StringComparison.Ordinal));
        Assert.False(seen.ContainsKey("authorization")); // the bearer token is not forwarded
    }
}
