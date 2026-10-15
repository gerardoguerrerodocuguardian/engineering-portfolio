package io.adflow.bidding.domain;

import java.util.Collection;
import java.util.Comparator;
import java.util.Optional;

/** Selects the winning campaign: keyword match, not exhausted, highest max bid (ties by id). */
public final class BidEngine {

    private BidEngine() {
    }

    public static Optional<BidDecision> decide(Collection<Campaign> campaigns, Collection<String> keywords) {
        return campaigns.stream()
                .filter(c -> !c.isExhausted())
                .filter(c -> c.matchesAny(keywords))
                .max(Comparator.comparingLong(Campaign::maxBidCents)
                        .thenComparing(Campaign::id, Comparator.reverseOrder()))
                .map(c -> new BidDecision(c.id(), Math.min(c.maxBidCents(), c.remainingBudgetCents()),
                        c.remainingBudgetCents()));
    }
}
