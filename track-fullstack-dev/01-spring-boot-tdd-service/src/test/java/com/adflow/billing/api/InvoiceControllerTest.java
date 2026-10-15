package com.adflow.billing.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.adflow.billing.domain.InvalidStateTransitionException;
import com.adflow.billing.domain.InvoiceStatus;
import com.adflow.billing.domain.TaxServiceUnavailableException;
import com.adflow.billing.domain.UnknownRegionException;
import com.adflow.billing.security.SecurityConfig;
import com.adflow.billing.service.InvoiceService;
import com.adflow.billing.service.InvoiceView;
import com.adflow.billing.service.NotFoundException;
import com.adflow.billing.service.ReportService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({InvoiceController.class, ReportController.class})
@Import(SecurityConfig.class)
class InvoiceControllerTest {

  private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private static final String VALID_BODY =
      """
      {"advertiserId":"adv-1","region":"US-CA",
       "lines":[{"campaignId":"cmp-1","description":"clicks","quantity":100,"unitPriceCents":100}],
       "discount":{"type":"PERCENT_BPS","value":1000}}""";

  @Autowired MockMvc mvc;
  @MockBean InvoiceService invoices;
  @MockBean ReportService reports;
  @MockBean JwtDecoder jwtDecoder;

  private static InvoiceView view(InvoiceStatus status) {
    return new InvoiceView(
        ID,
        "adv-1",
        "US-CA",
        status,
        10_000,
        1_000,
        725,
        653,
        9_653,
        Instant.parse("2026-01-01T00:00:00Z"),
        List.of(new InvoiceView.Line("cmp-1", "clicks", 100, 100)));
  }

  private static JwtRequestPostProcessor token(String... authorities) {
    return jwt()
        .authorities(
            java.util.Arrays.stream(authorities)
                .map(a -> (GrantedAuthority) new SimpleGrantedAuthority(a))
                .toList());
  }

  @Test
  void createReturns201WithLocationAndBody() throws Exception {
    given(invoices.create(any())).willReturn(view(InvoiceStatus.ISSUED));

    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY))
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", "/v1/invoices/" + ID))
        .andExpect(jsonPath("$.totalCents").value(9_653))
        .andExpect(jsonPath("$.status").value("ISSUED"));
  }

  @Test
  void invalidBodyIsProblemDetailWithFieldErrors() throws Exception {
    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"advertiserId\":\"\",\"region\":\"california\",\"lines\":[]}"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.title").value("Validation failed"))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.errors.length()").value(3));
    verifyNoInteractions(invoices);
  }

  @Test
  void unknownDiscountTypeIs400() throws Exception {
    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY.replace("PERCENT_BPS", "BOGUS")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void percentOverOneHundredIsDomainRejectedAs400() throws Exception {
    given(invoices.create(any())).willReturn(view(InvoiceStatus.ISSUED));

    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY.replace("\"value\":1000", "\"value\":20000")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("Invalid invoice"));
  }

  @Test
  void unknownRegionIs422AndTaxOutageIs503() throws Exception {
    given(invoices.create(any())).willThrow(new UnknownRegionException("US-CA"));
    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY))
        .andExpect(status().isUnprocessableEntity());

    willThrow(new TaxServiceUnavailableException("down", null)).given(invoices).create(any());
    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.title").value("Tax service unavailable"));
  }

  @Test
  void overflowIs400() throws Exception {
    given(invoices.create(any())).willThrow(new ArithmeticException("long overflow"));
    mvc.perform(
            post("/v1/invoices")
                .with(token("SCOPE_billing:write"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("Amount too large"));
  }

  @Test
  void getReturnsInvoiceOr404Problem() throws Exception {
    given(invoices.get(ID)).willReturn(view(InvoiceStatus.ISSUED));
    mvc.perform(get("/v1/invoices/" + ID).with(token("SCOPE_billing:read")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lines[0].campaignId").value("cmp-1"));

    UUID missing = UUID.randomUUID();
    given(invoices.get(missing)).willThrow(new NotFoundException("invoice", missing));
    mvc.perform(get("/v1/invoices/" + missing).with(token("SCOPE_billing:read")))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
  }

  @Test
  void malformedIdIs400() throws Exception {
    mvc.perform(get("/v1/invoices/not-a-uuid").with(token("SCOPE_billing:read")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void adminCanVoidAnIssuedInvoice() throws Exception {
    given(invoices.voidInvoice(ID)).willReturn(view(InvoiceStatus.VOID));

    mvc.perform(post("/v1/invoices/" + ID + "/void").with(token("ROLE_ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("VOID"));
  }

  @Test
  void voidingTwiceIs409Problem() throws Exception {
    given(invoices.voidInvoice(ID)).willThrow(new InvalidStateTransitionException("already void"));

    mvc.perform(post("/v1/invoices/" + ID + "/void").with(token("ROLE_ADMIN")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.title").value("Invalid state transition"));
  }
}
