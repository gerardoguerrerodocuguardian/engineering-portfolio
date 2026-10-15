package com.adflow.billing.service;

import com.adflow.billing.domain.InvoiceStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Read model returned by {@link InvoiceService}; all money in integer cents. */
public record InvoiceView(
    UUID id,
    String advertiserId,
    String region,
    InvoiceStatus status,
    long subtotalCents,
    long discountCents,
    int taxRateBps,
    long taxCents,
    long totalCents,
    Instant createdAt,
    List<Line> lines) {

  public record Line(String campaignId, String description, long quantity, long unitPriceCents) {}
}
