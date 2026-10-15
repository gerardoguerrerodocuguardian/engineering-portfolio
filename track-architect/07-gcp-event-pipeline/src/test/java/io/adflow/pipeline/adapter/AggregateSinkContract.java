package io.adflow.pipeline.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import io.adflow.pipeline.application.port.AggregateSink;
import io.adflow.pipeline.domain.AdEvent;
import io.adflow.pipeline.domain.EventType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Behaviour every AggregateSink adapter must satisfy. Subclasses supply the implementation. */
public abstract class AggregateSinkContract {

    protected abstract AggregateSink newSink();

    static AdEvent ev(EventType t, String c, long cost, String ts) {
        return new AdEvent(UUID.randomUUID(), t, c, cost, Instant.parse(ts));
    }

    static final LocalDate D1 = LocalDate.parse("2026-03-01");

    @Test
    void unknownKeyIsEmpty() {
        assertThat(newSink().find("nope", D1)).isEmpty();
    }

    @Test
    void aggregatesPerCampaignAndUtcDay() {
        AggregateSink s = newSink();
        s.write(List.of(
                ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T00:00:00Z"),
                ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T23:59:59Z"),
                ev(EventType.CLICK, "c1", 40, "2026-03-01T12:00:00Z"),
                ev(EventType.CLICK, "c1", 40, "2026-03-02T00:00:00Z"),
                ev(EventType.CLICK, "c2", 7, "2026-03-01T12:00:00Z")));
        var a = s.find("c1", D1).orElseThrow();
        assertThat(a.impressions()).isEqualTo(2);
        assertThat(a.clicks()).isEqualTo(1);
        assertThat(a.costCents()).isEqualTo(50);
        assertThat(s.find("c1", D1.plusDays(1)).orElseThrow().costCents()).isEqualTo(40);
        assertThat(s.find("c2", D1).orElseThrow().clicks()).isEqualTo(1);
    }

    @Test
    void replayingTheSameBatchIsIdempotent() {
        AggregateSink s = newSink();
        List<AdEvent> batch = List.of(ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T10:00:00Z"),
                ev(EventType.CLICK, "c1", 40, "2026-03-01T10:00:01Z"));
        s.write(batch);
        var first = s.find("c1", D1).orElseThrow();
        s.write(batch);
        s.write(batch);
        assertThat(s.find("c1", D1).orElseThrow()).isEqualTo(first);
    }

    @Test
    void incrementalBatchesAccumulateDistinctEventsOnly() {
        AggregateSink s = newSink();
        AdEvent a = ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T10:00:00Z");
        AdEvent b = ev(EventType.IMPRESSION, "c1", 6, "2026-03-01T10:00:05Z");
        s.write(List.of(a));
        s.write(List.of(a, b));
        var agg = s.find("c1", D1).orElseThrow();
        assertThat(agg.impressions()).isEqualTo(2);
        assertThat(agg.costCents()).isEqualTo(11);
    }

    @Test
    void duplicatesInsideOneBatchCountOnce() {
        AggregateSink s = newSink();
        AdEvent a = ev(EventType.CLICK, "c1", 9, "2026-03-01T10:00:00Z");
        s.write(List.of(a, a));
        assertThat(s.find("c1", D1).orElseThrow().clicks()).isEqualTo(1);
    }
}
