package com.adflow.auction.adapter

import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.Bid
import com.adflow.auction.domain.CampaignId
import com.adflow.auction.domain.Money
import com.adflow.auction.domain.ProviderId
import com.adflow.auction.port.BidProvider
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlin.time.Duration

/** How a simulated provider misbehaves. */
sealed interface Behavior {
    data object Bids : Behavior

    data object Declines : Behavior

    data object Fails : Behavior

    data object Hangs : Behavior
}

/**
 * Deterministic stand-in for a remote bidder: latency via [delay] (so virtual time works in tests), and a price
 * derived from the slot id, so the same request always produces the same bid. No randomness, no network.
 */
class SimulatedBidProvider(
    override val id: ProviderId,
    private val latency: Duration,
    private val basePrice: Money,
    private val spreadCents: Long,
    private val behavior: Behavior = Behavior.Bids,
) : BidProvider {
    override suspend fun requestBid(request: AuctionRequest): Bid? {
        when (behavior) {
            Behavior.Hangs -> awaitCancellation()
            else -> delay(latency)
        }
        return when (behavior) {
            Behavior.Declines -> null
            Behavior.Fails -> error("provider ${id.value} unavailable")
            Behavior.Bids, Behavior.Hangs -> {
                val jitter =
                    if (spreadCents >
                        0
                    ) {
                        Math.floorMod("${request.slot.value}/${id.value}".hashCode().toLong(), spreadCents)
                    } else {
                        0L
                    }
                Bid(id, CampaignId("cmp-${id.value}"), Money.ofCents(basePrice.cents + jitter) ?: basePrice)
            }
        }
    }
}
