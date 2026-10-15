package com.adflow.billing.api;

import com.adflow.billing.service.ReportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Implements GET /v1/campaigns/{id}/report from shared/contracts/campaign-api.openapi.yaml. */
@RestController
public class ReportController {

  public record UsageRequest(
      @PositiveOrZero long impressions,
      @PositiveOrZero long clicks,
      @PositiveOrZero long spendCents) {}

  public record ReportResponse(
      String campaignId, long impressions, long clicks, long spendCents, double ctr) {}

  private final ReportService service;

  public ReportController(ReportService service) {
    this.service = service;
  }

  @PostMapping("/v1/campaigns/{id}/usage")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void recordUsage(@PathVariable String id, @Valid @RequestBody UsageRequest body) {
    service.recordUsage(id, body.impressions(), body.clicks(), body.spendCents());
  }

  @GetMapping("/v1/campaigns/{id}/report")
  public ReportResponse report(@PathVariable String id) {
    var r = service.report(id);
    return new ReportResponse(r.campaignId(), r.impressions(), r.clicks(), r.spendCents(), r.ctr());
  }
}
