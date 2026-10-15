package io.adflow.bidding.adapters.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "processed_event")
class ProcessedEventEntity {

    @Id
    @Column(name = "event_id")
    UUID eventId;

    @Column(name = "processed_at", nullable = false)
    Instant processedAt;

    protected ProcessedEventEntity() {
    }

    ProcessedEventEntity(UUID eventId, Instant processedAt) {
        this.eventId = eventId;
        this.processedAt = processedAt;
    }
}
