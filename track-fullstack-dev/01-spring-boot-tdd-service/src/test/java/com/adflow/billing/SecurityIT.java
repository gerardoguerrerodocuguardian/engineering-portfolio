package com.adflow.billing;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
class SecurityIT {

  @Autowired MockMvc mvc;

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  @Test
  void noTokenIs401ProblemJson() throws Exception {
    mvc.perform(get("/v1/invoices/" + UUID.randomUUID()))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("WWW-Authenticate", "Bearer"))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  void expiredTokenIs401() throws Exception {
    String expired = TestJwt.token("billing:read", Instant.now().minusSeconds(120));
    mvc.perform(
            get("/v1/invoices/" + UUID.randomUUID())
                .header(HttpHeaders.AUTHORIZATION, bearer(expired)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void tamperedTokenIs401() throws Exception {
    String token = TestJwt.token("billing:read");
    String tampered = token.substring(0, token.length() - 4) + "AAAA";
    mvc.perform(
            get("/v1/invoices/" + UUID.randomUUID())
                .header(HttpHeaders.AUTHORIZATION, bearer(tampered)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void readScopeCannotWriteAndWriteScopeCannotRead() throws Exception {
    mvc.perform(
            post("/v1/invoices")
                .header(HttpHeaders.AUTHORIZATION, bearer(TestJwt.token("billing:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    mvc.perform(
            get("/v1/invoices/" + UUID.randomUUID())
                .header(HttpHeaders.AUTHORIZATION, bearer(TestJwt.token("billing:write"))))
        .andExpect(status().isForbidden());
  }

  @Test
  void healthIsPublicButMetricsNeedAdmin() throws Exception {
    mvc.perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
    mvc.perform(get("/actuator/metrics")).andExpect(status().isUnauthorized());
    mvc.perform(
            get("/actuator/metrics")
                .header(HttpHeaders.AUTHORIZATION, bearer(TestJwt.token("x", "admin"))))
        .andExpect(status().isOk())
        .andExpect(content().string(org.hamcrest.Matchers.containsString("jvm.memory.used")));
  }

  @Test
  void openApiDocsArePublic() throws Exception {
    mvc.perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/v1/invoices']").exists());
  }
}
