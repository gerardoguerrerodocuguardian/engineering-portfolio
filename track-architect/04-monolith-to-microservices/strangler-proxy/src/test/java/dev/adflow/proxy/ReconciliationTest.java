package dev.adflow.proxy;

import static dev.adflow.proxy.FakeBackend.c;
import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ReconciliationTest {
    private final FakeBackend legacy = new FakeBackend(1001), neu = new FakeBackend(5000);
    private final Reconciler rec = new Reconciler(legacy, neu);

    @Test
    void backfillThenReconcileIsClean() {
        for (int i = 1; i <= 5; i++) legacy.data.put((long) i, c(i, "C" + i, "ACTIVE"));
        assertEquals(5, rec.backfill());
        assertEquals(5, rec.backfill());   // idempotent
        var r = rec.reconcile(false);
        assertTrue(r.clean());
        assertEquals(5, r.diff().matched());
    }

    @Test
    void reportsMissingMismatchedAndNewOnlyRows() {
        legacy.data.put(1L, c(1, "A", "ACTIVE"));
        legacy.data.put(2L, c(2, "B", "ACTIVE"));
        legacy.data.put(3L, c(3, "C", "ACTIVE"));
        neu.data.put(1L, c(1, "A", "ACTIVE"));
        neu.data.put(2L, c(2, "B", "ARCHIVED"));   // drift
        neu.data.put(9L, c(9, "Only new", "ACTIVE"));
        var r = rec.reconcile(false);
        assertFalse(r.clean());
        assertEquals(1, r.diff().matched());
        assertEquals(java.util.List.of(3L), r.diff().missingInNew());
        assertEquals(java.util.List.of(9L), r.diff().missingInLegacy());
        assertEquals(java.util.Set.of(2L), r.diff().mismatched().keySet());
    }

    @Test
    void repairCopiesLegacyOverDriftButNeverDeletes() {
        legacy.data.put(1L, c(1, "A", "ACTIVE"));
        legacy.data.put(2L, c(2, "B", "ACTIVE"));
        neu.data.put(2L, c(2, "B", "PAUSED"));
        neu.data.put(9L, c(9, "Only new", "ACTIVE"));
        var r = rec.reconcile(true);
        assertEquals(2, r.repaired());
        assertEquals("ACTIVE", neu.data.get(2L).status());
        assertTrue(neu.data.containsKey(9L));              // still reported, not deleted
        assertEquals(java.util.List.of(9L), r.diff().missingInLegacy());
        assertTrue(r.diff().missingInNew().isEmpty() && r.diff().mismatched().isEmpty());
    }
}
