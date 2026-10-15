package com.adflow.billing.domain;

/** Aggregated performance of one campaign. CTR is a ratio, not money, so it is a double. */
public record CampaignReport(String campaignId, long impressions, long clicks, long spendCents) {

  public CampaignReport {
    if (impressions < 0 || clicks < 0 || spendCents < 0) {
      throw new InvalidInvoiceException("report figures must not be negative");
    }
    if (clicks > impressions) {
      throw new InvalidInvoiceException("clicks cannot exceed impressions");
    }
  }

  public double ctr() {
    return impressions == 0 ? 0.0 : (double) clicks / impressions;
  }
}
