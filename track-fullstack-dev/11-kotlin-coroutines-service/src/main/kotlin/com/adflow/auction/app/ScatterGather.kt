package com.adflow.auction.app

import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.ProviderOutcome
import com.adflow.auction.port.BidProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.asFlow
import kotlinx.coroutines.flow.flatMapMerge
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.withTimeout
import kotlin.time.Duration

/**
 * Calls every provider with at most [maxParallel] calls in flight. Each call gets its own [perCallTimeout]
 * (the clock starts when the call starts, not while it waits for a slot). A slow or failing provider yields a
 * [ProviderOutcome] value; the others are unaffected, which gives partial-result aggregation.
 *
 * Cancelling the caller cancels every in-flight call (structured concurrency); that is never swallowed.
 */
class ScatterGather(
    private val providers: List<BidProvider>,
    private val maxParallel: Int,
    private val perCallTimeout: Duration,
) {
    init {
        require(maxParallel >= 1) { "maxParallel must be >= 1" }
        require(perCallTimeout.isPositive()) { "perCallTimeout must be positive" }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    suspend fun gather(request: AuctionRequest): List<ProviderOutcome> =
        providers
            .asFlow()
            .flatMapMerge(concurrency = maxParallel) { provider -> flow { emit(call(provider, request)) } }
            .toList()

    private suspend fun call(
        provider: BidProvider,
        request: AuctionRequest,
    ): ProviderOutcome =
        try {
            val bid = withTimeout(perCallTimeout) { provider.requestBid(request) }
            if (bid == null) ProviderOutcome.Declined(provider.id) else ProviderOutcome.Responded(bid)
        } catch (_: TimeoutCancellationException) {
            // Only our own withTimeout throws this here; an outer cancellation arrives as plain CancellationException.
            ProviderOutcome.TimedOut(provider.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            ProviderOutcome.Failed(provider.id, e.message ?: e::class.simpleName.orEmpty())
        }
}
