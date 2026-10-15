package io.adflow.pipeline.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.EventType;
import io.adflow.pipeline.domain.InvalidEventException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.UUID;

/** Strict parser for the AsyncAPI AdImpression / AdClick payloads. */
public class AdEventParser {

    private final ObjectMapper mapper = new ObjectMapper();

    public AdEvent parse(String json) {
        try {
            JsonNode n = mapper.readTree(json);
            if (n == null || !n.isObject()) throw new InvalidEventException("payload is not a JSON object");
            JsonNode cost = n.get("costCents");
            if (cost == null || !cost.isIntegralNumber()) throw new InvalidEventException("costCents must be an integer");
            return new AdEvent(
                    UUID.fromString(text(n, "eventId")),
                    EventType.valueOf(text(n, "type")),
                    text(n, "campaignId"),
                    cost.asLong(),
                    Instant.parse(text(n, "occurredAt")));
        } catch (JsonProcessingException | IllegalArgumentException | DateTimeParseException e) {
            throw new InvalidEventException("malformed event: " + e.getMessage(), e);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || !v.isTextual()) throw new InvalidEventException(field + " is required");
        return v.asText();
    }
}
