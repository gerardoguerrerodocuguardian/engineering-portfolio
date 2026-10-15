package io.adflow.bidding.application;

import static org.junit.jupiter.api.Assertions.*;

import io.adflow.bidding.application.port.in.ProcessAdEventUseCase.Result;
import io.adflow.bidding.application.port.out.CampaignRepository;
import io.adflow.bidding.application.port.out.OutboxRepository;
import io.adflow.bidding.application.port.out.ProcessedEventRepository;
import io.adflow.bidding.application.service.AdEventProcessor;
import io.adflow.bidding.domain.AdEvent;
import io.adflow.bidding.domain.AdEventType;
import io.adflow.bidding.domain.BudgetExhausted;
import io.adflow.bidding.domain.Campaign;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Application-service test with in-memory fakes (no Spring context). */
class AdEventProcessorTest {

    private final Map<String, Campaign> store = new HashMap<>();
    private final Set<UUID> seen = new HashSet<>();
    private final List<BudgetExhausted> outboxed = new ArrayList<>();
    private AdEventProcessor processor;

    @BeforeEach
    void setUp() {
        store.put("c1", new Campaign("c1", List.of("shoes"), 100, 100, 0));
        processor = new AdEventProcessor(seen::add, new CampaignRepository() {
            public Optional<Campaign> findByIdForUpdate(String id) { return Optional.ofNullable(store.get(id)); }
            public List<Campaign> findAll() { return List.copyOf(store.values()); }
            public void save(Campaign c) { store.put(c.id(), c); }
        }, new OutboxRepository() {
            public void append(BudgetExhausted e) { outboxed.add(e); }
            public List<OutboxMessage> lockPending(int limit) { return List.of(); }
            public void markPublished(UUID id) { }
        }, Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), java.time.ZoneOffset.UTC));
    }

    private AdEvent event(UUID id, String campaign, long cost) {
        return new AdEvent(id, AdEventType.IMPRESSION, campaign, cost, Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void duplicateEventIsChargedOnce() {
        var id = UUID.randomUUID();
        assertEquals(Result.APPLIED, processor.process(event(id, "c1", 40)));
        assertEquals(Result.DUPLICATE, processor.process(event(id, "c1", 40)));
        assertEquals(40, store.get("c1").spentCents());
    }

    @Test
    void exhaustionEmitsExactlyOneOutboxMessage() {
        processor.process(event(UUID.randomUUID(), "c1", 60));
        processor.process(event(UUID.randomUUID(), "c1", 60));
        processor.process(event(UUID.randomUUID(), "c1", 60));
        assertEquals(1, outboxed.size());
        assertEquals("c1", outboxed.get(0).campaignId());
    }

    @Test
    void unknownCampaignIsReportedNotFailed() {
        assertEquals(Result.UNKNOWN_CAMPAIGN, processor.process(event(UUID.randomUUID(), "nope", 1)));
        assertTrue(outboxed.isEmpty());
    }
}
