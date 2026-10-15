package io.adflow.bidding.domain;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Sponsored-product campaign aggregate. Pure domain: no framework dependencies. */
public class Campaign {

    private final String id;
    private final Set<String> keywords;
    private final long maxBidCents;
    private final long budgetCents;
    private long spentCents;

    public Campaign(String id, Collection<String> keywords, long maxBidCents, long budgetCents, long spentCents) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("id is required");
        }
        if (maxBidCents < 0 || budgetCents < 0 || spentCents < 0) {
            throw new IllegalArgumentException("amounts must be >= 0");
        }
        this.id = id;
        this.keywords = keywords.stream().map(Campaign::normalize).collect(Collectors.toUnmodifiableSet());
        this.maxBidCents = maxBidCents;
        this.budgetCents = budgetCents;
        this.spentCents = Math.min(spentCents, budgetCents);
    }

    static String normalize(String keyword) {
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    public String id() { return id; }
    public Set<String> keywords() { return keywords; }
    public long maxBidCents() { return maxBidCents; }
    public long budgetCents() { return budgetCents; }
    public long spentCents() { return spentCents; }

    public long remainingBudgetCents() {
        return budgetCents - spentCents;
    }

    public boolean isExhausted() {
        return remainingBudgetCents() <= 0;
    }

    public boolean matchesAny(Collection<String> queryKeywords) {
        return queryKeywords.stream().map(Campaign::normalize).anyMatch(keywords::contains);
    }

    /**
     * Charges a cost against the budget (capped at the budget).
     *
     * @return true only when this charge made the campaign transition to exhausted
     */
    public boolean charge(long costCents) {
        if (costCents < 0) {
            throw new IllegalArgumentException("cost must be >= 0");
        }
        boolean wasExhausted = isExhausted();
        spentCents = Math.min(budgetCents, spentCents + costCents);
        return !wasExhausted && isExhausted();
    }
}
