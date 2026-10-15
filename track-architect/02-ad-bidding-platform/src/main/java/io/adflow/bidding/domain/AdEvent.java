package io.adflow.bidding.domain;

import java.time.Instant;
import java.util.UUID;

/** Impression or click event (see shared/contracts/ad-events.asyncapi.yaml). */
public record AdEvent(UUID eventId, AdEventType type, String campaignId, long costCents, Instant occurredAt) {

    public AdEvent {
        if (eventId == null || type == null || occurredAt == null) {
            throw new IllegalArgumentException("eventId, type and occurredAt are required");
        }
        if (campaignId == null || campaignId.isBlank()) {
            throw new IllegalArgumentException("campaignId is required");
        }
        if (costCents < 0) {
            throw new IllegalArgumentException("costCents must be >= 0");
        }
    }
}
