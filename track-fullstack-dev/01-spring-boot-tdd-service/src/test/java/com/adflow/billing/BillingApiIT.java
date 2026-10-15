package com.adflow.billing;

import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.notFound;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.serverError;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** Full-stack test: real security filter chain (signed JWTs), JPA + Flyway on H2, WireMock tax. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
class BillingApiIT {

  @RegisterExtension static WireMockExtension tax = WireMockExtension.newInstance().build();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("adflow.tax-client.base-url", tax::baseUrl);
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired MeterRegistry meters;
  @Autowired CacheManager caches;

  private static final String BODY =
      """
      {"advertiserId":"adv-1","region":"US-CA",
       "lines":[{"campaignId":"cmp-1","description":"clicks","quantity":100,"unitPriceCents":100},
                {"campaignId":"cmp-2","description":"impressions","quantity":5,"unitPriceCents":500}],
       "discount":{"type":"PERCENT_BPS","value":1000}}""";

  @BeforeEach
  void reset() {
    caches.getCache("taxRates").clear();
    tax.resetAll();
    tax.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get("/v1/tax-rates/US-CA")
            .willReturn(okJson("{\"region\":\"US-CA\",\"rateBps\":825}")));
  }

  private static String bearer(String scope, String... roles) {
    return "Bearer " + TestJwt.token(scope, roles);
  }

  @Test
  void createThenFetchInvoiceEndToEndWithCorrectMoneyMath() throws Exception {
    var created =
        mvc.perform(
                post("/v1/invoices")
                    .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(BODY))
            .andExpect(status().isCreated())
            .andExpect(header().exists("X-Correlation-Id"))
            .andExpect(jsonPath("$.subtotalCents").value(12_500))
            .andExpect(jsonPath("$.discountCents").value(1_250))
            .andExpect(jsonPath("$.taxCents").value(928))
            .andExpect(jsonPath("$.totalCents").value(12_178))
            .andReturn();
    JsonNode node = json.readTree(created.getResponse().getContentAsString());

    mvc.perform(
            get("/v1/invoices/" + node.get("id").asText())
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:read")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines.length()").value(2))
        .andExpect(jsonPath("$.taxRateBps").value(825));

    assertThat(meters.get("adflow.invoices.created").tag("region", "US-CA").counter().count())
        .isGreaterThanOrEqualTo(1.0);
  }

  @Test
  void taxRateIsCachedAcrossInvoices() throws Exception {
    for (int i = 0; i < 3; i++) {
      mvc.perform(
              post("/v1/invoices")
                  .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(BODY))
          .andExpect(status().isCreated());
    }
    tax.verify(1, getRequestedFor(urlEqualTo("/v1/tax-rates/US-CA")));
  }

  @Test
  void adminVoidsOnceThenConflict() throws Exception {
    var created =
        mvc.perform(
                post("/v1/invoices")
                    .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(BODY))
            .andReturn();
    String id = json.readTree(created.getResponse().getContentAsString()).get("id").asText();

    mvc.perform(
            post("/v1/invoices/" + id + "/void")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write")))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/v1/invoices/" + id + "/void")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write", "admin")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("VOID"));
    mvc.perform(
            post("/v1/invoices/" + id + "/void")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write", "admin")))
        .andExpect(status().isConflict());
  }

  @Test
  void taxServiceOutageYields503Problem() throws Exception {
    tax.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get("/v1/tax-rates/US-CA")
            .willReturn(serverError()));

    mvc.perform(
            post("/v1/invoices")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.status").value(503));
  }

  @Test
  void unknownRegionYields422() throws Exception {
    tax.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get("/v1/tax-rates/ZZ")
            .willReturn(notFound()));

    mvc.perform(
            post("/v1/invoices")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.replace("US-CA", "ZZ")))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void usageThenReportMatchesContractShape() throws Exception {
    for (String body :
        new String[] {
          "{\"impressions\":1000,\"clicks\":20,\"spendCents\":400}",
          "{\"impressions\":1000,\"clicks\":30,\"spendCents\":600}"
        }) {
      mvc.perform(
              post("/v1/campaigns/cmp-report/usage")
                  .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isAccepted());
    }

    mvc.perform(
            get("/v1/campaigns/cmp-report/report")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:read")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.impressions").value(2000))
        .andExpect(jsonPath("$.clicks").value(50))
        .andExpect(jsonPath("$.spendCents").value(1000))
        .andExpect(jsonPath("$.ctr").value(0.025));

    mvc.perform(
            get("/v1/campaigns/never-seen/report")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:read")))
        .andExpect(status().isNotFound());
  }

  @Test
  void invalidUsageIs400() throws Exception {
    mvc.perform(
            post("/v1/campaigns/cmp-x/usage")
                .header(HttpHeaders.AUTHORIZATION, bearer("billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"impressions\":1,\"clicks\":5,\"spendCents\":0}"))
        .andExpect(status().isBadRequest());
  }
}
