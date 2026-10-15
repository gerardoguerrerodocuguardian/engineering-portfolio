package com.adflow.billing.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.adflow.billing.TestJwt;
import com.adflow.billing.TestSecurityConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

/**
 * Consumer-side contract check against the monorepo's shared campaign-api.openapi.yaml. This
 * service implements only {@code GET /v1/campaigns/{id}/report} and the Problem error schema of
 * that contract (campaign CRUD belongs to the NestJS provider), so only those are verified: every
 * property the contract marks as required must be present with the declared JSON type.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
class CampaignApiContractTest {

  private static final Path CONTRACT =
      Path.of("..", "..", "shared", "contracts", "campaign-api.openapi.yaml");

  private static Map<String, Object> schemas;

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @BeforeAll
  @SuppressWarnings("unchecked")
  static void loadContract() throws IOException {
    assumeTrue(Files.exists(CONTRACT), "shared contract not found (project moved out of monorepo)");
    try (InputStream in = Files.newInputStream(CONTRACT)) {
      Map<String, Object> doc = new Yaml().load(in);
      schemas = (Map<String, Object>) ((Map<String, Object>) doc.get("components")).get("schemas");
    }
  }

  @SuppressWarnings("unchecked")
  private static void assertConforms(String schemaName, JsonNode body) {
    var schema = (Map<String, Object>) schemas.get(schemaName);
    var props = (Map<String, Map<String, Object>>) schema.get("properties");
    for (String required : (List<String>) schema.get("required")) {
      assertThat(body.has(required)).as("%s.%s is required", schemaName, required).isTrue();
      String type = (String) props.get(required).get("type");
      JsonNode v = body.get(required);
      switch (type) {
        case "string" -> assertThat(v.isTextual()).as(required).isTrue();
        case "integer" -> assertThat(v.isIntegralNumber()).as(required).isTrue();
        case "number" -> assertThat(v.isNumber()).as(required).isTrue();
        default -> {}
      }
    }
  }

  @Test
  void reportResponseConformsToCampaignReportSchema() throws Exception {
    mvc.perform(
        post("/v1/campaigns/cmp-contract/usage")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + TestJwt.token("billing:write"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"impressions\":100,\"clicks\":4,\"spendCents\":80}"));

    var body =
        mvc.perform(
                get("/v1/campaigns/cmp-contract/report")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + TestJwt.token("billing:read")))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertConforms("CampaignReport", json.readTree(body));
  }

  @Test
  void errorResponsesConformToProblemSchema() throws Exception {
    var notFound =
        mvc.perform(
                get("/v1/campaigns/missing/report")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + TestJwt.token("billing:read")))
            .andReturn()
            .getResponse();
    var forbidden =
        mvc.perform(
                post("/v1/campaigns/x/usage")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + TestJwt.token("billing:read"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andReturn()
            .getResponse();

    assertThat(notFound.getStatus()).isEqualTo(404);
    assertThat(forbidden.getStatus()).isEqualTo(403);
    assertThat(notFound.getContentType()).startsWith("application/problem+json");
    assertConforms("Problem", json.readTree(notFound.getContentAsString()));
    assertConforms("Problem", json.readTree(forbidden.getContentAsString()));
  }
}
