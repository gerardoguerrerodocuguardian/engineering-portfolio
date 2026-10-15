package dev.adflow.proxy;

import static dev.adflow.proxy.FakeBackend.c;
import static org.junit.jupiter.api.Assertions.*;

import dev.adflow.common.Campaign;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ParallelRunTest {
    private final MismatchLog log = new MismatchLog();
    private final ParallelRun pr = new ParallelRun(log);

    @Test
    void identicalResponsesProduceNoMismatch() {
        assertEquals(0, pr.compareList("/campaigns", List.of(c(1, "A", "ACTIVE")), List.of(c(1, "A", "ACTIVE"))));
        assertTrue(log.entries().isEmpty());
        assertEquals(1, log.comparedCount());
    }

    @Test
    void fieldDifferenceIsDetectedAndLogged() {
        int n = pr.compareOne("/campaigns", 1, Optional.of(c(1, "A", "ACTIVE")), Optional.of(c(1, "A", "PAUSED")));
        assertEquals(1, n);
        assertEquals(1, log.entries().size());
        assertTrue(log.entries().get(0).diffs().get(0).startsWith("status"));
        assertEquals("/campaigns/1", log.entries().get(0).ref());
    }

    @Test
    void missingRowsOnEitherSideAreDetected() {
        int n = pr.compareList("/campaigns",
                List.of(c(1, "A", "ACTIVE"), c(2, "B", "ACTIVE")),
                List.of(c(1, "A", "ACTIVE"), c(3, "C", "ACTIVE")));
        assertEquals(2, n);
        var diffs = log.entries().stream().flatMap(m -> m.diffs().stream()).toList();
        assertTrue(diffs.contains("missing in new"));
        assertTrue(diffs.contains("missing in legacy"));
    }

    @Test
    void knownLegacyNameTruncationIsNotAMismatch() {
        Campaign legacy = c(1, "Holiday Mega Promo E", "ACTIVE");
        Campaign neu = c(1, "Holiday Mega Promo Extended", "ACTIVE");
        assertEquals(0, pr.compareOne("/campaigns", 1, Optional.of(legacy), Optional.of(neu)));
    }

    @Test
    void facadeShadowsTheOtherSideOnlyWhenEnabled() {
        FakeBackend legacy = new FakeBackend(1001), neu = new FakeBackend(5000);
        legacy.data.put(1L, c(1, "A", "ACTIVE"));
        neu.data.put(1L, c(1, "A", "PAUSED")); // drift
        RouteConfig cfg = new RouteConfig(false);
        CampaignFacade f = new CampaignFacade(new Router(cfg), cfg, legacy, neu, pr, Runnable::run);
        f.get(1);
        assertTrue(log.entries().isEmpty());     // shadow off -> no second call
        assertEquals(0, neu.calls.get());
        cfg.setShadow(true);
        var served = f.get(1);
        assertEquals("legacy", served.servedBy());   // the client still gets the legacy answer
        assertEquals(1, log.entries().size());       // but the drift is surfaced
    }
}
