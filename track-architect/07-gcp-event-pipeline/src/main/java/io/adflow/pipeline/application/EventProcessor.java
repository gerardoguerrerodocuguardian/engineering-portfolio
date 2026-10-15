package io.adflow.pipeline.application;

import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.application.port.DedupeStore;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.InvalidEventException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Idempotent consumer. Two layers: a cheap {@link DedupeStore} fast path, and an idempotent sink as the
 * authoritative guard (the dedupe cache is lost on restart; the sink is not).
 */
public class EventProcessor {

    private static final Logger log = LoggerFactory.getLogger(EventProcessor.class);

    private final AdEventParser parser;
    private final DedupeStore dedupe;
    private final AggregateSink sink;

    public EventProcessor(AdEventParser parser, DedupeStore dedupe, AggregateSink sink) {
        this.parser = parser;
        this.dedupe = dedupe;
        this.sink = sink;
    }

    public ProcessingResult process(String payload) {
        AdEvent event;
        try {
            event = parser.parse(payload);
        } catch (InvalidEventException e) {
            log.warn("rejecting poison message: {}", e.getMessage());
            return ProcessingResult.REJECTED;
        }
        if (!dedupe.markIfNew(event.eventId())) {
            return ProcessingResult.DUPLICATE;
        }
        try {
            sink.write(List.of(event));
            return ProcessingResult.PROCESSED;
        } catch (RuntimeException e) {
            dedupe.forget(event.eventId()); // let the redelivery try again
            throw e;
        }
    }
}
