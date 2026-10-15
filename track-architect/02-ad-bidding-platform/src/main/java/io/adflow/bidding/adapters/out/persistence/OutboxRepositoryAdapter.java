package io.adflow.bidding.adapters.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.adflow.bidding.application.port.out.OutboxRepository;
import io.adflow.bidding.domain.BudgetExhausted;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class OutboxRepositoryAdapter implements OutboxRepository {

    private final SpringDataRepositories.OutboxJpa jpa;
    private final ObjectMapper mapper;
    private final Clock clock;

    OutboxRepositoryAdapter(SpringDataRepositories.OutboxJpa jpa, ObjectMapper mapper, Clock clock) {
        this.jpa = jpa;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Override
    public void append(BudgetExhausted event) {
        // Payload follows the BudgetExhausted message in ad-events.asyncapi.yaml
        var body = new LinkedHashMap<String, Object>();
        body.put("eventId", event.eventId().toString());
        body.put("campaignId", event.campaignId());
        body.put("occurredAt", event.occurredAt().toString());
        try {
            jpa.save(new OutboxEntity(event.eventId(), event.campaignId(),
                    mapper.writeValueAsString(body), clock.instant()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public List<OutboxMessage> lockPending(int limit) {
        return jpa.lockPending(limit).stream()
                .map(e -> new OutboxMessage(e.id, e.aggregateId, e.payload)).toList();
    }

    @Override
    public void markPublished(UUID id) {
        var entity = jpa.findById(id).orElseThrow();
        entity.publishedAt = clock.instant();
        jpa.save(entity);
    }
}
