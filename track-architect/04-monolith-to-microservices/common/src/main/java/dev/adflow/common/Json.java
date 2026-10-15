package dev.adflow.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private Json() {}

    public static String write(Object o) {
        try { return MAPPER.writeValueAsString(o); }
        catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }

    public static <T> T read(String s, Class<T> type) {
        try { return MAPPER.readValue(s, type); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("invalid JSON: " + e.getOriginalMessage(), e); }
    }

    public static JsonNode tree(String s) {
        try { return MAPPER.readTree(s); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("invalid JSON: " + e.getOriginalMessage(), e); }
    }
}
