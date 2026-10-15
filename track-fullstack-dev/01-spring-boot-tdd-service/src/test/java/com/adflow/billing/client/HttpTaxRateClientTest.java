package com.adflow.billing.client;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.adflow.billing.domain.TaxServiceUnavailableException;
import com.adflow.billing.domain.UnknownRegionException;
import com.github.tomakehurst.wiremock.junit5.WireMockRuntimeInfo;
import com.github.tomakehurst.wiremock.junit5.WireMockTest;
import com.github.tomakehurst.wiremock.stubbing.Scenario;
import java.time.Duration;
import org.junit.jupiter.api.Test;

@WireMockTest
class HttpTaxRateClientTest {

  private static final String PATH = "/v1/tax-rates/US-CA";

  private static TaxClientProperties props(WireMockRuntimeInfo wm) {
    return new TaxClientProperties(
        wm.getHttpBaseUrl(),
        Duration.ofMillis(200),
        Duration.ofMillis(300),
        3,
        Duration.ofMillis(10),
        4,
        4,
        50f,
        Duration.ofSeconds(30));
  }

  @Test
  void returnsRateFromTaxService(WireMockRuntimeInfo wm) {
    stubFor(get(PATH).willReturn(okJson("{\"region\":\"US-CA\",\"rateBps\":725}")));

    assertThat(new HttpTaxRateClient(props(wm)).rateBasisPoints("US-CA")).isEqualTo(725);
  }

  @Test
  void retriesTransientServerErrorsThenSucceeds(WireMockRuntimeInfo wm) {
    stubFor(
        get(PATH)
            .inScenario("flaky")
            .whenScenarioStateIs(Scenario.STARTED)
            .willReturn(serverError())
            .willSetStateTo("second"));
    stubFor(
        get(PATH)
            .inScenario("flaky")
            .whenScenarioStateIs("second")
            .willReturn(okJson("{\"region\":\"US-CA\",\"rateBps\":725}")));

    assertThat(new HttpTaxRateClient(props(wm)).rateBasisPoints("US-CA")).isEqualTo(725);
    verify(2, getRequestedFor(urlEqualTo(PATH)));
  }

  @Test
  void givesUpAfterMaxAttemptsAndReportsUnavailable(WireMockRuntimeInfo wm) {
    stubFor(get(PATH).willReturn(serverError()));

    assertThatThrownBy(() -> new HttpTaxRateClient(props(wm)).rateBasisPoints("US-CA"))
        .isInstanceOf(TaxServiceUnavailableException.class);
    verify(3, getRequestedFor(urlEqualTo(PATH)));
  }

  @Test
  void doesNotRetryUnknownRegion(WireMockRuntimeInfo wm) {
    stubFor(get(urlEqualTo("/v1/tax-rates/XX")).willReturn(notFound()));

    assertThatThrownBy(() -> new HttpTaxRateClient(props(wm)).rateBasisPoints("XX"))
        .isInstanceOf(UnknownRegionException.class);
    verify(1, getRequestedFor(urlEqualTo("/v1/tax-rates/XX")));
  }

  @Test
  void slowResponseTimesOutAndIsTreatedAsUnavailable(WireMockRuntimeInfo wm) {
    stubFor(get(PATH).willReturn(okJson("{\"rateBps\":725}").withFixedDelay(1_000)));

    assertThatThrownBy(() -> new HttpTaxRateClient(props(wm)).rateBasisPoints("US-CA"))
        .isInstanceOf(TaxServiceUnavailableException.class);
  }

  @Test
  void circuitOpensAfterRepeatedFailuresAndShortCircuitsCalls(WireMockRuntimeInfo wm) {
    stubFor(get(PATH).willReturn(serverError()));
    var client = new HttpTaxRateClient(props(wm));

    // window of 4 calls at 50% failure: 3 attempts + 1 more attempt open the breaker
    assertThatThrownBy(() -> client.rateBasisPoints("US-CA"))
        .isInstanceOf(TaxServiceUnavailableException.class);
    assertThatThrownBy(() -> client.rateBasisPoints("US-CA"))
        .isInstanceOf(TaxServiceUnavailableException.class);
    int callsBefore = findAll(getRequestedFor(urlEqualTo(PATH))).size();

    assertThatThrownBy(() -> client.rateBasisPoints("US-CA"))
        .isInstanceOf(TaxServiceUnavailableException.class)
        .hasMessageContaining("circuit");
    assertThat(findAll(getRequestedFor(urlEqualTo(PATH)))).hasSize(callsBefore);
  }
}
