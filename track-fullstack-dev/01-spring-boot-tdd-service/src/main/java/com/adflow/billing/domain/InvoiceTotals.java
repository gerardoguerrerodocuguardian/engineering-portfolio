package com.adflow.billing.domain;

/** Result of an invoice calculation. Invariant: total = subtotal - discount + tax. */
public record InvoiceTotals(Money subtotal, Money discount, Money tax, Money total) {}
