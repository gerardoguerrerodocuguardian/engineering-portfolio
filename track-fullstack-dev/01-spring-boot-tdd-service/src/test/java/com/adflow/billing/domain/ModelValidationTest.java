package com.adflow.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class ModelValidationTest {

  @Test
  void lineRequiresCampaignAndPositiveQuantity() {
    assertThatThrownBy(() -> new InvoiceLine(" ", "x", 1, Money.ZERO))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new InvoiceLine(null, "x", 1, Money.ZERO))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new InvoiceLine("c", "x", 0, Money.ZERO))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThat(new InvoiceLine("c", "x", 2, Money.ofCents(5)).total()).isEqualTo(Money.ofCents(10));
  }

  @Test
  void percentDiscountBoundsAreInclusive() {
    assertThat(new Discount.PercentOff(0).basisPoints()).isZero();
    assertThat(new Discount.PercentOff(10_000).basisPoints()).isEqualTo(10_000);
    assertThatThrownBy(() -> new Discount.PercentOff(-1))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new Discount.PercentOff(10_001))
        .isInstanceOf(InvalidInvoiceException.class);
  }

  @Test
  void calculatorRejectsEmptyLinesAndOutOfRangeTax() {
    var line = new InvoiceLine("c", "x", 1, Money.ofCents(100));
    var none = new Discount.None();
    assertThatThrownBy(() -> InvoiceCalculator.calculate(List.of(), none, 0))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> InvoiceCalculator.calculate(null, none, 0))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> InvoiceCalculator.calculate(List.of(line), none, -1))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> InvoiceCalculator.calculate(List.of(line), none, 10_001))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThat(InvoiceCalculator.calculate(List.of(line), none, 10_000).tax())
        .isEqualTo(Money.ofCents(100));
    assertThat(InvoiceCalculator.calculate(List.of(line), none, 0).tax()).isEqualTo(Money.ZERO);
  }

  @Test
  void voidingIsAllowedOnceOnly() {
    assertThat(InvoiceStatus.ISSUED.voided()).isEqualTo(InvoiceStatus.VOID);
    assertThatThrownBy(InvoiceStatus.VOID::voided)
        .isInstanceOf(InvalidStateTransitionException.class);
  }

  @Test
  void reportComputesCtrAndGuardsZeroImpressions() {
    assertThat(new CampaignReport("c", 1_000, 25, 500).ctr()).isEqualTo(0.025);
    assertThat(new CampaignReport("c", 0, 0, 0).ctr()).isZero();
    assertThatThrownBy(() -> new CampaignReport("c", 10, 11, 0))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new CampaignReport("c", -1, 0, 0))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new CampaignReport("c", 1, -1, 0))
        .isInstanceOf(InvalidInvoiceException.class);
    assertThatThrownBy(() -> new CampaignReport("c", 1, 0, -1))
        .isInstanceOf(InvalidInvoiceException.class);
  }
}
