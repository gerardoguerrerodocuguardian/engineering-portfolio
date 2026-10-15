package com.adflow.auction.app

import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.AuctionResult
import com.adflow.auction.domain.SecondPriceAuction

/** Use case: gather bids, then apply the pricing rule (pure, separately tested). */
class AuctionService(
    private val gatherer: ScatterGather,
) {
    suspend fun run(request: AuctionRequest): AuctionResult =
        SecondPriceAuction.decide(request.floor, gatherer.gather(request))
}
