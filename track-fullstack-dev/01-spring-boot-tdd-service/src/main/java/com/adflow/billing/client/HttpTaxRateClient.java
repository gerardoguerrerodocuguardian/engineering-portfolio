package com.adflow.billing.client;

import com.adflow.billing.domain.TaxServiceUnavailableException;
import com.adflow.billing.domain.UnknownRegionException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * RestClient adapter with Resilience4j. Order of decoration: Retry( CircuitBreaker( call ) ), so
 * every attempt is counted by the breaker and an open breaker stops further retries. Timeouts are
 * enforced by the HTTP client (connect + read) rather than a TimeLimiter, which would need a thread
 * pool for a blocking call.
 */
public class HttpTaxRateClient implements TaxRateClient {

  private record RateResponse(String region, int rateBps) {}

  private final RestClient restClient;
  private final Retry retry;
  private final CircuitBreaker circuitBreaker;

  public HttpTaxRateClient(TaxClientProperties props) {
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout((int) props.connectTimeout().toMillis());
    factory.setReadTimeout((int) props.readTimeout().toMillis());
    this.restClient = RestClient.builder().baseUrl(props.baseUrl()).requestFactory(factory).build();

    this.circuitBreaker =
        CircuitBreaker.of(
            "tax-service",
            CircuitBreakerConfig.custom()
                .slidingWindowSize(props.breakerWindowSize())
                .minimumNumberOfCalls(props.breakerMinimumCalls())
                .failureRateThreshold(props.breakerFailureRatePercent())
                .waitDurationInOpenState(props.breakerOpenDuration())
                .recordExceptions(ResourceAccessException.class, HttpServerErrorException.class)
                .build());
    this.retry =
        Retry.of(
            "tax-service",
            RetryConfig.custom()
                .maxAttempts(props.maxAttempts())
                .waitDuration(props.retryWait())
                .retryExceptions(ResourceAccessException.class, HttpServerErrorException.class)
                .build());
  }

  public CircuitBreaker circuitBreaker() {
    return circuitBreaker;
  }

  @Override
  public int rateBasisPoints(String region) {
    Supplier<Integer> call =
        Retry.decorateSupplier(
            retry, CircuitBreaker.decorateSupplier(circuitBreaker, () -> fetch(region)));
    try {
      return call.get();
    } catch (UnknownRegionException e) {
      throw e;
    } catch (CallNotPermittedException e) {
      throw new TaxServiceUnavailableException("tax service circuit is open", e);
    } catch (RuntimeException e) {
      throw new TaxServiceUnavailableException("tax service call failed: " + e.getMessage(), e);
    }
  }

  private int fetch(String region) {
    RateResponse body =
        restClient
            .get()
            .uri("/v1/tax-rates/{region}", region)
            .retrieve()
            .onStatus(
                status -> status.value() == HttpStatus.NOT_FOUND.value(),
                (req, res) -> {
                  throw new UnknownRegionException(region);
                })
            .body(RateResponse.class);
    if (body == null) {
      throw new ResourceAccessException("empty tax service response");
    }
    return body.rateBps();
  }
}
