package io.adflow.bidding.domain;

/** Outcome of a bid auction for a set of keywords. */
public record BidDecision(String campaignId, long bidCents, long remainingBudgetCents) {
}
