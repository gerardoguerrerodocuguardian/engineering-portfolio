package com.adflow.billing.domain;

import java.util.List;

/** Pure invoice arithmetic: subtotal, discount, tax, total. All amounts are integer cents. */
public final class InvoiceCalculator {

  private InvoiceCalculator() {}

  public static InvoiceTotals calculate(
      List<InvoiceLine> lines, Discount discount, int taxRateBasisPoints) {
    if (lines == null || lines.isEmpty()) {
      throw new InvalidInvoiceException("at least one line is required");
    }
    if (taxRateBasisPoints < 0 || taxRateBasisPoints > 10_000) {
      throw new InvalidInvoiceException("tax rate must be within 0..10000 basis points");
    }
    Money subtotal = lines.stream().map(InvoiceLine::total).reduce(Money.ZERO, Money::plus);
    Money discountAmount = discountFor(subtotal, discount);
    Money taxable = subtotal.minus(discountAmount);
    Money tax = taxable.percentOf(taxRateBasisPoints);
    return new InvoiceTotals(subtotal, discountAmount, tax, taxable.plus(tax));
  }

  private static Money discountFor(Money subtotal, Discount discount) {
    return switch (discount) {
      case Discount.None none -> Money.ZERO;
      case Discount.PercentOff p -> subtotal.percentOf(p.basisPoints());
      case Discount.FixedOff f -> f.amount().min(subtotal);
    };
  }
}
