package io.adflow.pipeline.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

/** An impression or click, as defined by shared/contracts/ad-events.asyncapi.yaml. */
public record AdEvent(UUID eventId, EventType type, String campaignId, long costCents, Instant occurredAt) {

    public AdEvent {
        if (eventId == null || type == null || occurredAt == null) {
            throw new InvalidEventException("eventId, type and occurredAt are required");
        }
        if (campaignId == null || campaignId.isBlank()) {
            throw new InvalidEventException("campaignId is required");
        }
        if (costCents < 0) {
            throw new InvalidEventException("costCents must be >= 0");
        }
    }

    /** Aggregation day, always UTC so that results do not depend on the host time zone. */
    public LocalDate day() {
        return occurredAt.atZone(ZoneOffset.UTC).toLocalDate();
    }
}
