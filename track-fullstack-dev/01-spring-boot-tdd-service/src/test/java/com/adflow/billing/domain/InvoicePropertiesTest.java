package com.adflow.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/** Property-based tests: invariants that must hold for every valid invoice, not just examples. */
class InvoicePropertiesTest {

  @Provide
  Arbitrary<InvoiceLine> lines() {
    return Combinators.combine(
            Arbitraries.longs().between(1, 10_000), Arbitraries.longs().between(0, 1_000_000))
        .as((qty, price) -> new InvoiceLine("cmp-1", "line", qty, Money.ofCents(price)));
  }

  @Provide
  Arbitrary<List<InvoiceLine>> lineLists() {
    return lines().list().ofMinSize(1).ofMaxSize(20);
  }

  @Provide
  Arbitrary<Discount> discounts() {
    return Arbitraries.oneOf(
        Arbitraries.just(new Discount.None()),
        Arbitraries.integers().between(0, 10_000).map(Discount.PercentOff::new),
        Arbitraries.longs()
            .between(0, 50_000_000)
            .map(c -> new Discount.FixedOff(Money.ofCents(c))));
  }

  @Property
  void totalEqualsSubtotalMinusDiscountPlusTax(
      @ForAll("lineLists") List<InvoiceLine> lines,
      @ForAll("discounts") Discount discount,
      @ForAll @IntRange(min = 0, max = 10_000) int taxBps) {
    var t = InvoiceCalculator.calculate(lines, discount, taxBps);

    assertThat(t.total().cents())
        .isEqualTo(t.subtotal().cents() - t.discount().cents() + t.tax().cents());
  }

  @Property
  void discountNeverExceedsSubtotalAndTaxNeverExceedsTaxableAmount(
      @ForAll("lines") InvoiceLine line,
      @ForAll("discounts") Discount discount,
      @ForAll @IntRange(min = 0, max = 10_000) int taxBps) {
    var t = InvoiceCalculator.calculate(List.of(line), discount, taxBps);

    assertThat(t.discount()).isLessThanOrEqualTo(t.subtotal());
    long taxable = t.subtotal().cents() - t.discount().cents();
    assertThat(t.tax().cents()).isLessThanOrEqualTo(taxable);
    assertThat(t.total().cents()).isGreaterThanOrEqualTo(0);
  }

  @Property
  void taxIsWithinHalfACentOfTheExactValue(
      @ForAll("lines") InvoiceLine line, @ForAll @IntRange(min = 0, max = 10_000) int taxBps) {
    var t = InvoiceCalculator.calculate(List.of(line), new Discount.None(), taxBps);

    long exactTimes10k = t.subtotal().cents() * taxBps;
    long diff = Math.abs(t.tax().cents() * 10_000 - exactTimes10k);
    assertThat(diff).isLessThanOrEqualTo(5_000);
  }

  @Property
  void higherTaxRateNeverLowersTheTotal(
      @ForAll("lines") InvoiceLine line, @ForAll @IntRange(min = 0, max = 9_999) int taxBps) {
    var low = InvoiceCalculator.calculate(List.of(line), new Discount.None(), taxBps);
    var high = InvoiceCalculator.calculate(List.of(line), new Discount.None(), taxBps + 1);

    assertThat(high.total()).isGreaterThanOrEqualTo(low.total());
  }

  @Property
  void lineOrderDoesNotChangeTheTotals(
      @ForAll("lines") InvoiceLine a,
      @ForAll("lines") InvoiceLine b,
      @ForAll("discounts") Discount discount) {
    assertThat(InvoiceCalculator.calculate(List.of(a, b), discount, 825))
        .isEqualTo(InvoiceCalculator.calculate(List.of(b, a), discount, 825));
  }
}
