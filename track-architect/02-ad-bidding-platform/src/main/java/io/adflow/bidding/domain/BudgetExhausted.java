package io.adflow.bidding.domain;

import java.time.Instant;
import java.util.UUID;

/** Domain event emitted when a campaign budget reaches zero. */
public record BudgetExhausted(UUID eventId, String campaignId, Instant occurredAt) {
}
