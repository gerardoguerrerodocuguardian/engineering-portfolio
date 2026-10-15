package com.adflow.auction.port

import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.Bid
import com.adflow.auction.domain.ProviderId

/** Outbound port: one remote bidder. Return null to decline; throw only for unexpected failures. */
interface BidProvider {
    val id: ProviderId

    suspend fun requestBid(request: AuctionRequest): Bid?
}
