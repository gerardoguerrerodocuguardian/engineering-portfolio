package io.adflow.pipeline.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.adflow.pipeline.adapter.in.InMemoryEventSource;
import io.adflow.pipeline.adapter.out.InMemoryAggregateSink;
import io.adflow.pipeline.adapter.out.InMemoryDedupeStore;
import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.domain.AdEvent;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EventProcessorTest {

    static String json(UUID id, String type, String campaign, long cost) {
        return "{\"eventId\":\"" + id + "\",\"type\":\"" + type + "\",\"campaignId\":\"" + campaign
                + "\",\"costCents\":" + cost + ",\"occurredAt\":\"2026-03-01T10:00:00Z\"}";
    }

    final LocalDate day = LocalDate.parse("2026-03-01");
    final InMemoryAggregateSink sink = new InMemoryAggregateSink();
    final EventProcessor processor = new EventProcessor(new AdEventParser(), new InMemoryDedupeStore(100), sink);

    @Test
    void duplicateDeliveryHasNoSecondEffect() {
        UUID id = UUID.randomUUID();
        assertThat(processor.process(json(id, "CLICK", "c1", 40))).isEqualTo(ProcessingResult.PROCESSED);
        assertThat(processor.process(json(id, "CLICK", "c1", 40))).isEqualTo(ProcessingResult.DUPLICATE);
        assertThat(sink.find("c1", day).orElseThrow().costCents()).isEqualTo(40);
    }

    @Test
    void poisonMessagesAreRejected() {
        assertThat(processor.process("not json")).isEqualTo(ProcessingResult.REJECTED);
        assertThat(processor.process("{\"eventId\":\"x\"}")).isEqualTo(ProcessingResult.REJECTED);
        assertThat(processor.process(json(UUID.randomUUID(), "VIEW", "c1", 1))).isEqualTo(ProcessingResult.REJECTED);
        assertThat(processor.process(json(UUID.randomUUID(), "CLICK", "c1", -5))).isEqualTo(ProcessingResult.REJECTED);
    }

    @Test
    void failedWriteIsRetriedOnRedelivery() {
        int[] calls = {0};
        AggregateSink flaky = new AggregateSink() {
            @Override public void write(List<AdEvent> events) {
                if (calls[0]++ == 0) throw new IllegalStateException("sink down");
                sink.write(events);
            }
            @Override public java.util.Optional<io.adflow.pipeline.domain.CampaignDayAggregate> find(String c, LocalDate d) { return sink.find(c, d); }
        };
        var p = new EventProcessor(new AdEventParser(), new InMemoryDedupeStore(10), flaky);
        String msg = json(UUID.randomUUID(), "IMPRESSION", "c1", 3);
        assertThatThrownBy(() -> p.process(msg)).isInstanceOf(IllegalStateException.class);
        assertThat(p.process(msg)).isEqualTo(ProcessingResult.PROCESSED);
        assertThat(sink.find("c1", day).orElseThrow().impressions()).isEqualTo(1);
    }

    @Test
    void inMemorySourceAcksAndNacks() {
        var src = new InMemoryEventSource();
        src.start(processor::process);
        assertThat(src.deliver(json(UUID.randomUUID(), "CLICK", "c1", 1))).isTrue();
        assertThat(src.deliver("garbage")).isFalse(); // nack -> broker dead-letters after max attempts
    }
}
