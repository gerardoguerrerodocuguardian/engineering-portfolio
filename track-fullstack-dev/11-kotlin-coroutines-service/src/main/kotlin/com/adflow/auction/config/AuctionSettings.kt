package com.adflow.auction.config

import com.adflow.auction.adapter.Behavior
import com.adflow.auction.adapter.SimulatedBidProvider
import com.adflow.auction.app.ScatterGather
import com.adflow.auction.domain.Money
import com.adflow.auction.domain.ProviderId
import com.adflow.auction.domain.cents
import com.adflow.auction.port.BidProvider
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

@DslMarker
annotation class AuctionDsl

data class AuctionSettings(
    val providers: List<BidProvider>,
    val maxParallel: Int,
    val perCallTimeout: Duration,
)

fun AuctionSettings.toScatterGather(): ScatterGather = ScatterGather(providers, maxParallel, perCallTimeout)

@AuctionDsl
class SimulatedProviderBuilder(
    private val id: String,
) {
    var latency: Duration = 20.milliseconds
    var basePrice: Money = 100.cents
    var spreadCents: Long = 50
    var behavior: Behavior = Behavior.Bids

    internal fun build() = SimulatedBidProvider(ProviderId(id), latency, basePrice, spreadCents, behavior)
}

@AuctionDsl
class ProvidersBuilder {
    private val items = mutableListOf<BidProvider>()

    fun simulated(
        id: String,
        block: SimulatedProviderBuilder.() -> Unit = {},
    ) {
        items += SimulatedProviderBuilder(id).apply(block).build()
    }

    fun custom(provider: BidProvider) {
        items += provider
    }

    internal fun build(): List<BidProvider> = items.toList()
}

@AuctionDsl
class AuctionSettingsBuilder {
    var maxParallel: Int = 4
    var perCallTimeout: Duration = 250.milliseconds
    private var providers: List<BidProvider> = emptyList()

    fun providers(block: ProvidersBuilder.() -> Unit) {
        providers = ProvidersBuilder().apply(block).build()
    }

    internal fun build() = AuctionSettings(providers, maxParallel, perCallTimeout)
}

fun auctionSettings(block: AuctionSettingsBuilder.() -> Unit): AuctionSettings =
    AuctionSettingsBuilder().apply(block).build()

/** Demo wiring: four well-behaved bidders, one slow (times out), one failing. */
fun demoSettings(): AuctionSettings =
    auctionSettings {
        maxParallel = 3
        perCallTimeout = 200.milliseconds
        providers {
            simulated("alpha") { basePrice = 120.cents }
            simulated("bravo") {
                basePrice = 150.cents
                latency = 60.milliseconds
            }
            simulated("charlie") { basePrice = 90.cents }
            simulated("delta") { behavior = Behavior.Declines }
            simulated("echo") { behavior = Behavior.Hangs }
            simulated("foxtrot") { behavior = Behavior.Fails }
        }
    }
