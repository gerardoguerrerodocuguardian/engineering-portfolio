package io.adflow.pipeline.adapter.in;

import io.adflow.pipeline.application.port.EventHandler;
import io.adflow.pipeline.application.port.EventSource;

/**
 * Placeholder showing the Kafka mapping of the same port; intentionally not implemented here (the Kafka
 * version lives in track-architect/02-ad-bidding-platform). Mapping: poll() batch -> handler per record;
 * commit offsets only after the handler returned; REJECTED -> publish to a DLT then commit; exception ->
 * seek back / do not commit. Ordering comes from the record key (campaignId) per partition.
 */
public class KafkaEventSourceStub implements EventSource {

    @Override public void start(EventHandler handler) {
        throw new UnsupportedOperationException("Kafka adapter is a stub; see 02-ad-bidding-platform");
    }

    @Override public void stop() { /* nothing to stop */ }
}
