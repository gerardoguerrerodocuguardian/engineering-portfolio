using System.Diagnostics;
using System.Net;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Proxy;

namespace AdFlow.Gateway.Tests;

[Trait("Step", "07")]
public class SecurityHeaderTests
{
    [Fact]
    public async Task Responses_carry_secure_headers_and_no_server_banner()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/api/v1/campaigns");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single(), StringComparison.Ordinal);
        Assert.False(response.Headers.Contains("Server"));
    }

    [Fact]
    public async Task Forwarded_headers_from_untrusted_peers_are_ignored()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:IpFilter:Deny:0"] = "9.9.9.9/32" });
        using var client = h.Client("192.0.2.77", "alice");
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/campaigns");
        request.Headers.Add("X-Forwarded-For", "9.9.9.9");

        var response = await client.SendAsync(request);

        // 9.9.9.9 is denied, but the gateway does not believe a peer that is not a known proxy.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

[Trait("Step", "09")]
public class TimeoutTests
{
    [Fact]
    public async Task Slow_downstream_yields_504_after_the_activity_timeout()
    {
        await using var h = await Harness.CreateAsync(new() { ["ReverseProxy:Clusters:campaigns:HttpRequest:ActivityTimeout"] = "00:00:01" });
        foreach (var backend in h.Campaigns)
        {
            backend.Delay = TimeSpan.FromSeconds(5);
        }

        using var client = h.Client(user: "alice");
        var watch = Stopwatch.StartNew();
        var response = await client.GetAsync("/api/v1/campaigns");
        watch.Stop();

        Assert.Equal(HttpStatusCode.GatewayTimeout, response.StatusCode);
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(4), $"took {watch.Elapsed}");
    }
}

[Trait("Step", "10")]
public class HealthCheckTests
{
    private static async Task<bool> OnlyServedByAsync(HttpClient client, string expected, int consecutive)
    {
        for (var i = 0; i < consecutive; i++)
        {
            var response = await client.GetAsync("/api/v1/campaigns");
            if (!response.Headers.TryGetValues("X-Served-By", out var served) || served.Single() != expected)
            {
                return false;
            }
        }

        return true;
    }

    [Fact]
    public async Task Active_health_check_takes_an_unhealthy_instance_out_of_rotation()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:Resilience:Enabled"] = "false",
            ["ReverseProxy:Clusters:campaigns:HealthCheck:Active:Enabled"] = "true",
            ["ReverseProxy:Clusters:campaigns:HealthCheck:Active:Interval"] = "00:00:00.200",
            ["ReverseProxy:Clusters:campaigns:HealthCheck:Active:Timeout"] = "00:00:01",
        });
        h.Campaigns[0].Healthy = false;
        h.Campaigns[0].FailAll = true;
        using var client = h.Client(user: "alice");

        var converged = false;
        for (var attempt = 0; attempt < 50 && !converged; attempt++)
        {
            converged = await OnlyServedByAsync(client, "campaigns-2", 10);
            if (!converged)
            {
                await Task.Delay(100);
            }
        }

        Assert.True(converged, "traffic never converged on the healthy instance");
    }

    [Fact]
    public async Task Passive_health_check_fails_over_when_an_instance_goes_down()
    {
        await using var h = await Harness.CreateAsync(new()
        {
            ["Gateway:Resilience:Enabled"] = "false",
            // Judge the destination after a single failed request instead of the default minimum sample.
            ["ReverseProxy:Clusters:campaigns:Metadata:TransportFailureRateHealthPolicy.MinimalTotalCountThreshold"] = "1",
        });
        using var client = h.Client(user: "alice");
        await h.Campaigns[0].DisposeAsync(); // transport failures from now on

        var converged = false;
        for (var attempt = 0; attempt < 100 && !converged; attempt++)
        {
            converged = await OnlyServedByAsync(client, "campaigns-2", 10);
        }

        Assert.True(converged, "traffic never converged on the surviving instance");
    }
}

[Trait("Step", "13")]
public class LoadBalancingTests
{
    [Fact]
    public async Task Round_robin_spreads_requests_over_both_instances()
    {
        await using var h = await Harness.CreateAsync(new() { ["ReverseProxy:Clusters:campaigns:LoadBalancingPolicy"] = "RoundRobin" });
        using var client = h.Client(user: "alice");

        for (var i = 0; i < 6; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/campaigns")).StatusCode);
        }

        Assert.Equal(3, h.Campaigns[0].Requests.Count);
        Assert.Equal(3, h.Campaigns[1].Requests.Count);
    }
}

[Trait("Step", "14")]
public class ResilienceHandlerTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Calls;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref Calls);
            return Task.FromResult(respond(request));
        }
    }

    private static HttpResponseMessage Fail(HttpRequestMessage _) => new(HttpStatusCode.InternalServerError);

    private static HttpMessageInvoker Invoker(StubHandler stub, ResilienceOptions options) =>
        new(new IdempotentResilienceHandler(options, stub));

    [Fact]
    public async Task Idempotent_get_is_retried()
    {
        var stub = new StubHandler(Fail);
        var options = new ResilienceOptions { RetryCount = 2, BaseDelayMs = 1, BreakerMinThroughput = 100 };
        using var invoker = Invoker(stub, options);

        var response = await invoker.SendAsync(new HttpRequestMessage(HttpMethod.Get, "http://downstream.test/x"), CancellationToken.None);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(3, stub.Calls); // 1 attempt + 2 retries
    }

    [Fact]
    public async Task Post_is_never_retried()
    {
        var stub = new StubHandler(Fail);
        var options = new ResilienceOptions { RetryCount = 2, BaseDelayMs = 1, BreakerMinThroughput = 100 };
        using var invoker = Invoker(stub, options);

        var request = new HttpRequestMessage(HttpMethod.Post, "http://downstream.test/x") { Content = new StringContent("{}") };
        await invoker.SendAsync(request, CancellationToken.None);

        Assert.Equal(1, stub.Calls);
    }

    [Fact]
    public async Task Circuit_opens_after_repeated_failures_and_short_circuits_with_503()
    {
        var stub = new StubHandler(Fail);
        var options = new ResilienceOptions
        {
            RetryCount = 0,
            BreakerFailureRatio = 0.5,
            BreakerMinThroughput = 4,
            BreakerSamplingSeconds = 30,
            BreakerBreakSeconds = 30,
        };
        using var invoker = Invoker(stub, options);

        for (var i = 0; i < 4; i++)
        {
            await invoker.SendAsync(new HttpRequestMessage(HttpMethod.Get, "http://downstream.test/x"), CancellationToken.None);
        }

        var callsBefore = stub.Calls;
        var rejected = await invoker.SendAsync(new HttpRequestMessage(HttpMethod.Get, "http://downstream.test/x"), CancellationToken.None);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, rejected.StatusCode);
        Assert.True(rejected.Headers.Contains("X-Gateway-Circuit"));
        Assert.Equal(callsBefore, stub.Calls); // the downstream was not called while the circuit is open
    }

    [Fact]
    public async Task Breakers_are_per_destination()
    {
        var stub = new StubHandler(r => r.RequestUri!.Host == "sick.test" ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : new HttpResponseMessage(HttpStatusCode.OK));
        var options = new ResilienceOptions { RetryCount = 0, BreakerMinThroughput = 4, BreakerBreakSeconds = 30 };
        using var invoker = Invoker(stub, options);

        for (var i = 0; i < 5; i++)
        {
            await invoker.SendAsync(new HttpRequestMessage(HttpMethod.Get, "http://sick.test/x"), CancellationToken.None);
        }

        var healthy = await invoker.SendAsync(new HttpRequestMessage(HttpMethod.Get, "http://fine.test/x"), CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, healthy.StatusCode);
    }
}

[Trait("Step", "11")]
public class CorrelationTests
{
    [Fact]
    public async Task Incoming_traceparent_is_honoured_echoed_and_propagated_downstream()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");
        const string traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/campaigns");
        request.Headers.Add("traceparent", $"00-{traceId}-00f067aa0ba902b7-01");

        var response = await client.SendAsync(request);

        Assert.Equal(traceId, response.Headers.GetValues("X-Correlation-Id").Single());
        var downstream = h.Campaigns.SelectMany(b => b.Requests).Single().Headers["traceparent"];
        Assert.StartsWith($"00-{traceId}-", downstream, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_new_trace_is_started_when_none_is_supplied()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var response = await client.GetAsync("/api/v1/campaigns");

        var id = response.Headers.GetValues("X-Correlation-Id").Single();
        Assert.Equal(32, id.Length);
        Assert.Contains(id, h.Campaigns.SelectMany(b => b.Requests).Single().Headers["traceparent"], StringComparison.Ordinal);
    }
}

[Trait("Step", "16")]
public class VersioningTests
{
    [Fact]
    public async Task V1_and_v2_map_to_different_downstream_paths_and_v1_announces_its_sunset()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client(user: "alice");

        var v1 = await client.GetAsync("/api/v1/campaigns");
        var v2 = await client.GetAsync("/api/v2/campaigns");

        Assert.Equal(HttpStatusCode.OK, v1.StatusCode);
        Assert.Equal(HttpStatusCode.OK, v2.StatusCode);
        var paths = h.Campaigns.SelectMany(b => b.Requests).Select(r => r.PathAndQuery).OrderBy(p => p).ToArray();
        Assert.Equal(new[] { "/campaigns", "/v2/campaigns" }, paths);
        Assert.True(v1.Headers.Contains("Sunset"));
        Assert.False(v2.Headers.Contains("Sunset"));
    }
}

[Trait("Step", "18")]
public class CachingTests
{
    [Fact]
    public async Task Safe_gets_are_cached_per_user_and_never_shared_between_users()
    {
        await using var h = await Harness.CreateAsync(new() { ["Gateway:Cache:Enabled"] = "true", ["Gateway:Cache:TtlSeconds"] = "30" });
        using var alice = h.Client(user: "alice");
        using var bob = h.Client(user: "bob");

        await alice.GetAsync("/api/v1/campaigns");
        await alice.GetAsync("/api/v1/campaigns");
        Assert.Equal(1, h.Campaigns.Sum(b => b.Requests.Count)); // second call served from the gateway cache

        await bob.GetAsync("/api/v1/campaigns");
        Assert.Equal(2, h.Campaigns.Sum(b => b.Requests.Count)); // different identity, different cache entry
    }
}

[Trait("Step", "15")]
public class MetricsTests
{
    [Fact]
    public async Task Metrics_endpoint_requires_an_allowlisted_ip_and_the_admin_role()
    {
        await using var h = await Harness.CreateAsync();
        using var outsider = h.Client("198.51.100.7", "root");
        using var anonymousInside = h.Client("10.1.2.3");
        using var nonAdminInside = h.Client("10.1.2.3", "alice");
        using var adminInside = h.Client("10.1.2.3", "root");

        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync("/admin/metrics")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymousInside.GetAsync("/admin/metrics")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await nonAdminInside.GetAsync("/admin/metrics")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await adminInside.GetAsync("/admin/metrics")).StatusCode);
    }
}

[Trait("Step", "12")]
public class AuditTests
{
    [Fact]
    public async Task Rejected_access_is_written_to_the_audit_trail()
    {
        await using var h = await Harness.CreateAsync();
        using var client = h.Client("198.51.100.20");

        await client.GetAsync("/api/v1/campaigns");

        using var admin = h.Client("10.1.2.3", "root");
        var body = await admin.GetStringAsync("/admin/audit?take=10");
        Assert.Contains("access_rejected", body, StringComparison.Ordinal);
        Assert.Contains("198.51.100.20", body, StringComparison.Ordinal);
    }
}
