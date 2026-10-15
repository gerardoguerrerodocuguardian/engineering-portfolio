package com.adflow.billing.domain;

/** Discount applied to the subtotal before tax. */
public sealed interface Discount {

  /** No discount. */
  record None() implements Discount {}

  /** Percentage off in basis points (1 bp = 0.01%); 0..10000. */
  record PercentOff(int basisPoints) implements Discount {
    public PercentOff {
      if (basisPoints < 0 || basisPoints > 10_000) {
        throw new InvalidInvoiceException("basis points must be within 0..10000");
      }
    }
  }

  /** Fixed amount off, capped at the subtotal. */
  record FixedOff(Money amount) implements Discount {}
}
