using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using AdFlow.Gateway.Configuration;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;

namespace AdFlow.Gateway.Proxy;

/// <summary>
/// Retry + circuit breaker for idempotent body-less requests (GET/HEAD) only, implemented with Polly v8.
///
/// How this relates to YARP: YARP does not use IHttpClientFactory, so Microsoft.Extensions.Http.Resilience's
/// "standard handler" cannot simply be attached to a named client. Instead we plug a DelegatingHandler into the
/// HttpMessageInvoker that YARP builds (see <see cref="GatewayForwarderHttpClientFactory"/>). The handler sees one
/// outbound request to an already-chosen destination, so a retry goes back to the SAME destination. Moving traffic to
/// the other replica is the job of YARP's health checks and load balancer, which is why both are enabled.
/// Requests with a body are never retried (the body stream is consumed and a POST may not be idempotent).
/// </summary>
public sealed class IdempotentResilienceHandler : DelegatingHandler
{
    private readonly ResilienceOptions _options;
    private readonly ConcurrentDictionary<string, ResiliencePipeline<HttpResponseMessage>> _pipelines = new();

    public IdempotentResilienceHandler(ResilienceOptions options, HttpMessageHandler inner)
        : base(inner)
    {
        _options = options;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (!_options.Enabled || !IsRetryable(request))
        {
            return await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
        }

        // One breaker per destination (scheme + host + port), so one sick replica does not trip the whole cluster.
        var key = request.RequestUri is { } uri ? uri.GetLeftPart(UriPartial.Authority) : "unknown";
        var pipeline = _pipelines.GetOrAdd(key, _ => BuildPipeline());
        try
        {
            return await pipeline.ExecuteAsync(
                async (CancellationToken token) => await base.SendAsync(request, token).ConfigureAwait(false),
                cancellationToken).ConfigureAwait(false);
        }
        catch (BrokenCircuitException)
        {
            return CircuitOpenResponse(request);
        }
    }

    private static bool IsRetryable(HttpRequestMessage request) =>
        (request.Method == HttpMethod.Get || request.Method == HttpMethod.Head) && request.Content is null;

    private static bool ShouldHandle(Outcome<HttpResponseMessage> outcome) =>
        outcome.Exception is HttpRequestException
        || (outcome.Result is { } response && (int)response.StatusCode >= 500);

    private ResiliencePipeline<HttpResponseMessage> BuildPipeline()
    {
        var builder = new ResiliencePipelineBuilder<HttpResponseMessage>();
        if (_options.RetryCount > 0)
        {
            builder.AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                MaxRetryAttempts = _options.RetryCount,
                Delay = TimeSpan.FromMilliseconds(_options.BaseDelayMs),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                ShouldHandle = args => ValueTask.FromResult(ShouldHandle(args.Outcome)),
                OnRetry = args =>
                {
                    args.Outcome.Result?.Dispose(); // release the failed response before the next attempt
                    return default;
                },
            });
        }

        builder.AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
        {
            FailureRatio = _options.BreakerFailureRatio,
            MinimumThroughput = Math.Max(2, _options.BreakerMinThroughput),
            SamplingDuration = TimeSpan.FromSeconds(Math.Max(1, _options.BreakerSamplingSeconds)),
            BreakDuration = TimeSpan.FromSeconds(Math.Max(1, _options.BreakerBreakSeconds)),
            ShouldHandle = args => ValueTask.FromResult(ShouldHandle(args.Outcome)),
        });

        return builder.Build();
    }

    private HttpResponseMessage CircuitOpenResponse(HttpRequestMessage request)
    {
        var response = new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
        {
            RequestMessage = request,
            Content = new StringContent("{\"error\":\"circuit_open\"}", Encoding.UTF8, "application/json"),
        };
        response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(Math.Max(1, _options.BreakerBreakSeconds)));
        response.Headers.TryAddWithoutValidation("X-Gateway-Circuit", "open");
        return response;
    }
}
