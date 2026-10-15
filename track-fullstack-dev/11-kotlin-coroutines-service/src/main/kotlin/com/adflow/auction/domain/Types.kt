package com.adflow.auction.domain

/** Money in integer cents (USD). A value class: no allocation at runtime, no mixing with other Longs. */
@JvmInline
value class Money private constructor(
    val cents: Long,
) : Comparable<Money> {
    override fun compareTo(other: Money): Int = cents.compareTo(other.cents)

    override fun toString(): String = "$cents¢"

    companion object {
        val ZERO = Money(0)

        /** Returns null for negative amounts: callers at a boundary decide how to report it. */
        fun ofCents(cents: Long): Money? = if (cents >= 0) Money(cents) else null
    }
}

/** Test-and-demo friendly literal; throws on negative input because that is a programming error. */
val Long.cents: Money get() = requireNotNull(Money.ofCents(this)) { "negative amount: $this" }
val Int.cents: Money get() = toLong().cents

@JvmInline
value class CampaignId(
    val value: String,
) {
    init {
        require(value.isNotBlank()) { "CampaignId must not be blank" }
    }
}

@JvmInline
value class ProviderId(
    val value: String,
) {
    init {
        require(value.isNotBlank()) { "ProviderId must not be blank" }
    }
}

@JvmInline
value class SlotId(
    val value: String,
) {
    init {
        require(value.isNotBlank()) { "SlotId must not be blank" }
    }
}

/** A validated request to sell one ad slot. Immutable. */
data class AuctionRequest(
    val slot: SlotId,
    val floor: Money,
)

data class Bid(
    val provider: ProviderId,
    val campaign: CampaignId,
    val price: Money,
)
