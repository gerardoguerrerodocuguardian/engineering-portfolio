package com.adflow.auction

import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.Bid
import com.adflow.auction.domain.CampaignId
import com.adflow.auction.domain.ProviderId
import com.adflow.auction.domain.SlotId
import com.adflow.auction.domain.cents
import com.adflow.auction.port.BidProvider
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicInteger
import kotlin.time.Duration

fun bid(
    provider: String,
    cents: Long,
) = Bid(ProviderId(provider), CampaignId("cmp-$provider"), cents.cents)

fun request(floor: Long = 0) = AuctionRequest(SlotId("slot-1"), floor.cents)

/** Provider that suspends for [latency] (virtual time under runTest) then runs [action]. */
class FakeProvider(
    name: String,
    private val latency: Duration = Duration.ZERO,
    private val tracker: Tracker? = null,
    private val action: suspend () -> Bid? = { bid(name, 100) },
) : BidProvider {
    override val id = ProviderId(name)

    override suspend fun requestBid(request: AuctionRequest): Bid? {
        tracker?.enter()
        try {
            delay(latency)
            return action()
        } finally {
            tracker?.exit()
        }
    }
}

class Tracker {
    private val current = AtomicInteger()
    val max = AtomicInteger()

    fun enter() {
        max.accumulateAndGet(current.incrementAndGet(), ::maxOf)
    }

    fun exit() {
        current.decrementAndGet()
    }
}
