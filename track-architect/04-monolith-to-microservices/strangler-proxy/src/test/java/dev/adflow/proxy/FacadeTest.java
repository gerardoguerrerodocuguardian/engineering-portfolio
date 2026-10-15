package dev.adflow.proxy;

import static dev.adflow.proxy.FakeBackend.c;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class FacadeTest {
    private final FakeBackend legacy = new FakeBackend(1001), neu = new FakeBackend(5000);
    private final RouteConfig cfg = new RouteConfig(false);
    private final CampaignFacade f = new CampaignFacade(new Router(cfg), cfg, legacy, neu,
            new ParallelRun(new MismatchLog()), Runnable::run);

    @Test
    void newServiceFailureFallsBackToLegacy() {
        legacy.data.put(1L, c(1, "A", "ACTIVE"));
        cfg.setPercent("/campaigns", 100);
        neu.failing = true;
        var s = f.list("k");
        assertEquals("legacy-fallback", s.servedBy());
        assertEquals(1, s.value().size());
        assertEquals(1, f.fallbacks.get());
    }

    @Test
    void createDualWritesToBothSides() {
        var s = f.create(c(0, "New one", "ACTIVE"), "k");   // 0% -> legacy primary
        assertEquals("legacy", s.servedBy());
        assertEquals(1001, s.value().id());
        assertEquals(s.value(), neu.data.get(1001L));

        cfg.setPercent("/campaigns", 100);
        var s2 = f.create(c(0, "Second", "ACTIVE"), "k");   // 100% -> new primary, legacy kept in sync
        assertEquals("new", s2.servedBy());
        assertEquals(s2.value(), legacy.data.get(s2.value().id()));
    }

    @Test
    void secondaryWriteFailureIsCountedNotPropagated() {
        neu.failing = true;
        var s = f.create(c(0, "X", "ACTIVE"), "k");
        assertEquals("legacy", s.servedBy());
        assertEquals(1, f.dualWriteFailures.get());
    }
}
