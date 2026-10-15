package com.adflow.billing.domain;

/** One billable line: a campaign charge of {@code quantity} units at {@code unitPrice}. */
public record InvoiceLine(String campaignId, String description, long quantity, Money unitPrice) {

  public InvoiceLine {
    if (campaignId == null || campaignId.isBlank()) {
      throw new InvalidInvoiceException("campaignId is required");
    }
    if (quantity <= 0) {
      throw new InvalidInvoiceException("quantity must be positive");
    }
  }

  public Money total() {
    return unitPrice.times(quantity);
  }
}
