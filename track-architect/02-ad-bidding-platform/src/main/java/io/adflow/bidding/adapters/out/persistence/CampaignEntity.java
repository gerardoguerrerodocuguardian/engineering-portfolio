package io.adflow.bidding.adapters.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "campaign")
class CampaignEntity {

    @Id
    String id;

    /** Comma-separated, lower-cased keywords. */
    @Column(nullable = false)
    String keywords;

    @Column(name = "max_bid_cents", nullable = false)
    long maxBidCents;

    @Column(name = "budget_cents", nullable = false)
    long budgetCents;

    @Column(name = "spent_cents", nullable = false)
    long spentCents;

    protected CampaignEntity() {
    }
}
