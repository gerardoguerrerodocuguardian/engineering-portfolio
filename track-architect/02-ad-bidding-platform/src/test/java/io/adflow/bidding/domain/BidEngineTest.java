package io.adflow.bidding.domain;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class BidEngineTest {

    private static Campaign c(String id, String kw, long maxBid, long budget, long spent) {
        return new Campaign(id, List.of(kw), maxBid, budget, spent);
    }

    @Test
    void highestMaxBidWins() {
        var d = BidEngine.decide(List.of(c("a", "shoes", 50, 1000, 0), c("b", "shoes", 90, 1000, 0)),
                List.of("shoes")).orElseThrow();
        assertEquals("b", d.campaignId());
        assertEquals(90, d.bidCents());
        assertEquals(1000, d.remainingBudgetCents());
    }

    @Test
    void bidIsCappedByRemainingBudget() {
        var d = BidEngine.decide(List.of(c("a", "shoes", 90, 100, 70)), List.of("shoes")).orElseThrow();
        assertEquals(30, d.bidCents());
        assertEquals(30, d.remainingBudgetCents());
    }

    @Test
    void exhaustedAndNonMatchingCampaignsAreIgnored() {
        var result = BidEngine.decide(
                List.of(c("a", "shoes", 90, 100, 100), c("b", "hats", 90, 100, 0)), List.of("shoes"));
        assertTrue(result.isEmpty());
    }

    @Test
    void tiesBreakDeterministicallyByLowestId() {
        var d = BidEngine.decide(List.of(c("b", "x", 10, 100, 0), c("a", "x", 10, 100, 0)), List.of("x"))
                .orElseThrow();
        assertEquals("a", d.campaignId());
    }
}
