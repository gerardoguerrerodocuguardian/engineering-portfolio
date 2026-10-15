package io.adflow.bidding.adapters.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox")
class OutboxEntity {

    @Id
    UUID id;

    @Column(name = "aggregate_id", nullable = false)
    String aggregateId;

    @Column(nullable = false)
    String payload;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "published_at")
    Instant publishedAt;

    protected OutboxEntity() {
    }

    OutboxEntity(UUID id, String aggregateId, String payload, Instant createdAt) {
        this.id = id;
        this.aggregateId = aggregateId;
        this.payload = payload;
        this.createdAt = createdAt;
    }
}
