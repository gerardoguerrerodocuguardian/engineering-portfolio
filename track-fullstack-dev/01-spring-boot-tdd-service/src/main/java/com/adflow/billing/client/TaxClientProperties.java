package com.adflow.billing.client;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("adflow.tax-client")
public record TaxClientProperties(
    String baseUrl,
    Duration connectTimeout,
    Duration readTimeout,
    int maxAttempts,
    Duration retryWait,
    int breakerWindowSize,
    int breakerMinimumCalls,
    float breakerFailureRatePercent,
    Duration breakerOpenDuration) {

  public static TaxClientProperties defaults(String baseUrl) {
    return new TaxClientProperties(
        baseUrl,
        Duration.ofMillis(500),
        Duration.ofSeconds(1),
        3,
        Duration.ofMillis(50),
        10,
        5,
        50f,
        Duration.ofSeconds(30));
  }
}
