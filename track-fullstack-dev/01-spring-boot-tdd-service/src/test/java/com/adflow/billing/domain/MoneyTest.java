package com.adflow.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class MoneyTest {

  @Test
  void rejectsNegativeAmounts() {
    assertThatThrownBy(() -> Money.ofCents(-1)).isInstanceOf(InvalidInvoiceException.class);
  }

  @Test
  void addsMultipliesAndComparesExactly() {
    assertThat(Money.ofCents(150).plus(Money.ofCents(50))).isEqualTo(Money.ofCents(200));
    assertThat(Money.ofCents(150).minus(Money.ofCents(50))).isEqualTo(Money.ofCents(100));
    assertThat(Money.ofCents(7).times(3)).isEqualTo(Money.ofCents(21));
    assertThat(Money.ofCents(7)).isLessThan(Money.ofCents(8));
    assertThat(Money.ofCents(7).min(Money.ofCents(8))).isEqualTo(Money.ofCents(7));
    assertThat(Money.ofCents(8).min(Money.ofCents(7))).isEqualTo(Money.ofCents(7));
  }

  @Test
  void zeroQuantityIsAllowedAndYieldsZero() {
    assertThat(Money.ofCents(7).times(0)).isEqualTo(Money.ZERO);
  }

  @Test
  void rejectsNegativeQuantity() {
    assertThatThrownBy(() -> Money.ofCents(7).times(-1))
        .isInstanceOf(InvalidInvoiceException.class);
  }

  @Test
  void overflowFailsLoudlyInsteadOfWrappingAround() {
    assertThatThrownBy(() -> Money.ofCents(Long.MAX_VALUE).plus(Money.ofCents(1)))
        .isInstanceOf(ArithmeticException.class);
    assertThatThrownBy(() -> Money.ofCents(Long.MAX_VALUE).times(2))
        .isInstanceOf(ArithmeticException.class);
  }

  @Test
  void percentRoundsHalfUpAtTheBoundary() {
    assertThat(Money.ofCents(1).percentOf(5_000)).isEqualTo(Money.ofCents(1)); // 0.5 -> 1
    assertThat(Money.ofCents(1).percentOf(4_999)).isEqualTo(Money.ZERO); // 0.4999 -> 0
    assertThat(Money.ofCents(3).percentOf(5_000)).isEqualTo(Money.ofCents(2)); // 1.5 -> 2
    assertThat(Money.ofCents(10_000).percentOf(10_000)).isEqualTo(Money.ofCents(10_000));
  }
}
