package com.adflow.auction.domain

/** What one bid provider did for one request. Expected failures are values, not exceptions. */
sealed interface ProviderOutcome {
    val provider: ProviderId

    data class Responded(
        val bid: Bid,
    ) : ProviderOutcome {
        override val provider: ProviderId get() = bid.provider
    }

    /** The provider answered in time and chose not to bid. */
    data class Declined(
        override val provider: ProviderId,
    ) : ProviderOutcome

    /** The provider could not contribute to the auction. */
    sealed interface Unavailable : ProviderOutcome

    data class TimedOut(
        override val provider: ProviderId,
    ) : Unavailable

    data class Failed(
        override val provider: ProviderId,
        val reason: String,
    ) : Unavailable
}

sealed interface AuctionResult {
    /** [participants] counts bids at or above the floor. */
    data class Won(
        val winner: Bid,
        val clearingPrice: Money,
        val participants: Int,
        val unavailable: List<ProviderOutcome.Unavailable>,
    ) : AuctionResult

    data class NoWinner(
        val unavailable: List<ProviderOutcome.Unavailable>,
    ) : AuctionResult
}

/**
 * Second-price (Vickrey) rule:
 *  - bids below the floor are ignored;
 *  - the highest remaining bid wins, ties are broken by provider id (ascending) so the result is deterministic;
 *  - the winner pays max(second-highest eligible bid, floor), so clearingPrice <= winning bid and >= floor;
 *  - a lone eligible bidder pays the floor.
 * The result does not depend on the order in which providers answered.
 */
object SecondPriceAuction {
    private val ranking = compareByDescending<Bid> { it.price }.thenBy { it.provider.value }

    fun decide(
        floor: Money,
        outcomes: List<ProviderOutcome>,
    ): AuctionResult {
        val unavailable = outcomes.filterIsInstance<ProviderOutcome.Unavailable>()
        val ranked =
            outcomes
                .filterIsInstance<ProviderOutcome.Responded>()
                .map { it.bid }
                .filter { it.price >= floor }
                .sortedWith(ranking)
        val winner = ranked.firstOrNull() ?: return AuctionResult.NoWinner(unavailable)
        val runnerUp = ranked.getOrNull(1)?.price ?: floor
        return AuctionResult.Won(winner, maxOf(runnerUp, floor), ranked.size, unavailable)
    }
}
