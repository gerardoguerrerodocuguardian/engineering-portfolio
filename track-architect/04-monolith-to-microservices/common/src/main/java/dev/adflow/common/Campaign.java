package dev.adflow.common;

/** The NEW domain model owned by the campaign service (ISO dates, enum-like status, minor-unit money). */
public record Campaign(long id, String name, Money budget, String status, String startDate) {}
