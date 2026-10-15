package io.adflow.bidding.domain;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class CampaignTest {

    private Campaign campaign(long budget, long spent) {
        return new Campaign("c1", List.of("Shoes", " Running "), 100, budget, spent);
    }

    @Test
    void chargeReducesRemainingBudget() {
        var c = campaign(1000, 0);
        assertFalse(c.charge(300));
        assertEquals(700, c.remainingBudgetCents());
    }

    @Test
    void chargeReportsExhaustionTransitionExactlyOnce() {
        var c = campaign(100, 50);
        assertTrue(c.charge(50));
        assertTrue(c.isExhausted());
        assertFalse(c.charge(10));
    }

    @Test
    void spendIsCappedAtBudget() {
        var c = campaign(100, 90);
        c.charge(500);
        assertEquals(100, c.spentCents());
        assertEquals(0, c.remainingBudgetCents());
    }

    @Test
    void keywordMatchingIsCaseAndWhitespaceInsensitive() {
        var c = campaign(100, 0);
        assertTrue(c.matchesAny(List.of("RUNNING")));
        assertTrue(c.matchesAny(List.of("x", "shoes")));
        assertFalse(c.matchesAny(List.of("laptop")));
    }

    @Test
    void rejectsNegativeCost() {
        assertThrows(IllegalArgumentException.class, () -> campaign(100, 0).charge(-1));
    }
}
