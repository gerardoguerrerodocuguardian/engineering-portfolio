package com.adflow.billing.domain;

/** Non-negative amount of money in integer cents (USD). No floating point anywhere. */
public record Money(long cents) implements Comparable<Money> {

  public static final Money ZERO = new Money(0);

  public Money {
    if (cents < 0) {
      throw new InvalidInvoiceException("money must not be negative: " + cents);
    }
  }

  public static Money ofCents(long cents) {
    return new Money(cents);
  }

  public Money plus(Money other) {
    return new Money(Math.addExact(cents, other.cents));
  }

  public Money minus(Money other) {
    return new Money(cents - other.cents);
  }

  public Money times(long quantity) {
    if (quantity < 0) {
      throw new InvalidInvoiceException("quantity must not be negative: " + quantity);
    }
    return new Money(Math.multiplyExact(cents, quantity));
  }

  /** Basis-point share of this amount, rounded half-up using integer arithmetic only. */
  public Money percentOf(int basisPoints) {
    long scaled = Math.multiplyExact(cents, (long) basisPoints);
    return new Money(scaled / 10_000 + (scaled % 10_000 >= 5_000 ? 1 : 0));
  }

  public Money min(Money other) {
    return cents <= other.cents ? this : other;
  }

  @Override
  public int compareTo(Money other) {
    return Long.compare(cents, other.cents);
  }
}
