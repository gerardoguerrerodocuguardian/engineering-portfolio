package com.adflow.billing.domain;

public enum InvoiceStatus {
  ISSUED,
  VOID;

  /** Only an issued invoice can be voided; voiding twice is a conflict. */
  public InvoiceStatus voided() {
    if (this == VOID) {
      throw new InvalidStateTransitionException("invoice is already void");
    }
    return VOID;
  }
}
