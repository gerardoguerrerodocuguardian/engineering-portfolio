package dev.adflow.common;

/** New-model money: integer minor units plus ISO currency. */
public record Money(long amountMinor, String currency) {}
