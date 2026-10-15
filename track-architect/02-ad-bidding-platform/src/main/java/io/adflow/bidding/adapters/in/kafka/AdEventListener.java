package io.adflow.bidding.adapters.in.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.adflow.bidding.application.port.in.ProcessAdEventUseCase;
import io.adflow.bidding.domain.AdEvent;
import io.adflow.bidding.domain.AdEventType;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Inbound adapter for topic adflow.ad-events. Malformed payloads are logged and skipped. */
@Component
class AdEventListener {

    private static final Logger log = LoggerFactory.getLogger(AdEventListener.class);

    record AdEventMessage(String eventId, String type, String campaignId, Long costCents, String occurredAt) {
    }

    private final ObjectMapper mapper;
    private final ProcessAdEventUseCase useCase;

    AdEventListener(ObjectMapper mapper, ProcessAdEventUseCase useCase) {
        this.mapper = mapper;
        this.useCase = useCase;
    }

    @KafkaListener(topics = "${adflow.topics.ad-events}", groupId = "${spring.kafka.consumer.group-id}")
    void onMessage(String payload) {
        AdEvent event;
        try {
            event = toDomain(mapper.readValue(payload, AdEventMessage.class));
        } catch (JsonProcessingException | RuntimeException e) {
            // Poison message: retrying cannot help. Production: route to a dead-letter topic.
            log.warn("Skipping malformed ad event: {}", e.getMessage());
            return;
        }
        var result = useCase.process(event);
        log.debug("event {} -> {}", event.eventId(), result);
    }

    static AdEvent toDomain(AdEventMessage m) {
        return new AdEvent(UUID.fromString(m.eventId()), AdEventType.valueOf(m.type()), m.campaignId(),
                m.costCents(), Instant.parse(m.occurredAt()));
    }
}
