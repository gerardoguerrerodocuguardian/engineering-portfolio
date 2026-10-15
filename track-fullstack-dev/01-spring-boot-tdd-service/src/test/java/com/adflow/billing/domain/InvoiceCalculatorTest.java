package com.adflow.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class InvoiceCalculatorTest {

  private static InvoiceLine line(long qty, long unitCents) {
    return new InvoiceLine("cmp-1", "clicks", qty, Money.ofCents(unitCents));
  }

  @Test
  void sumsLinesAppliesPercentDiscountThenTax() {
    // subtotal 10_000 + 2_500 = 12_500; 10% off = 1_250; taxable 11_250; 8.25% tax = 928.125 -> 928
    var totals =
        InvoiceCalculator.calculate(
            List.of(line(100, 100), line(5, 500)), new Discount.PercentOff(1_000), 825);

    assertThat(totals.subtotal()).isEqualTo(Money.ofCents(12_500));
    assertThat(totals.discount()).isEqualTo(Money.ofCents(1_250));
    assertThat(totals.tax()).isEqualTo(Money.ofCents(928));
    assertThat(totals.total()).isEqualTo(Money.ofCents(11_250 + 928));
  }

  @Test
  void fixedDiscountIsCappedAtSubtotalSoTotalNeverGoesNegative() {
    var totals =
        InvoiceCalculator.calculate(
            List.of(line(10, 100)), new Discount.FixedOff(Money.ofCents(5_000)), 825);

    assertThat(totals.discount()).isEqualTo(Money.ofCents(1_000));
    assertThat(totals.tax()).isEqualTo(Money.ZERO);
    assertThat(totals.total()).isEqualTo(Money.ZERO);
  }

  @Test
  void fixedDiscountBelowSubtotalIsSubtractedBeforeTax() {
    var totals =
        InvoiceCalculator.calculate(
            List.of(line(10, 100)), new Discount.FixedOff(Money.ofCents(200)), 1_000);

    assertThat(totals.discount()).isEqualTo(Money.ofCents(200));
    assertThat(totals.tax()).isEqualTo(Money.ofCents(80));
    assertThat(totals.total()).isEqualTo(Money.ofCents(880));
  }

  @Test
  void noDiscountOnlyTaxes() {
    var totals = InvoiceCalculator.calculate(List.of(line(1, 999)), new Discount.None(), 500);

    assertThat(totals.discount()).isEqualTo(Money.ZERO);
    assertThat(totals.tax()).isEqualTo(Money.ofCents(50)); // 49.95 rounds half-up
    assertThat(totals.total()).isEqualTo(Money.ofCents(1_049));
  }
}
