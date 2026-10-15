package io.adflow.pipeline.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DomainTest {

    static AdEvent ev(EventType t, String c, long cost, String ts) {
        return new AdEvent(UUID.randomUUID(), t, c, cost, Instant.parse(ts));
    }

    @Test
    void aggregateCountsAndSums() {
        var a = CampaignDayAggregate.of("c1", java.time.LocalDate.parse("2026-03-01"), List.of(
                ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T10:00:00Z"),
                ev(EventType.IMPRESSION, "c1", 5, "2026-03-01T11:00:00Z"),
                ev(EventType.CLICK, "c1", 40, "2026-03-01T11:00:01Z")));
        assertThat(a.impressions()).isEqualTo(2);
        assertThat(a.clicks()).isEqualTo(1);
        assertThat(a.costCents()).isEqualTo(50);
    }

    @Test
    void dayIsUtc() {
        assertThat(ev(EventType.CLICK, "c1", 1, "2026-03-01T23:59:59Z").day().toString()).isEqualTo("2026-03-01");
        assertThat(ev(EventType.CLICK, "c1", 1, "2026-03-02T00:00:00Z").day().toString()).isEqualTo("2026-03-02");
    }

    @Test
    void rejectsInvalid() {
        assertThatThrownBy(() -> ev(EventType.CLICK, " ", 1, "2026-03-01T00:00:00Z")).isInstanceOf(InvalidEventException.class);
        assertThatThrownBy(() -> ev(EventType.CLICK, "c", -1, "2026-03-01T00:00:00Z")).isInstanceOf(InvalidEventException.class);
    }
}
