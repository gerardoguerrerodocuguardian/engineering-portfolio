package com.adflow.auction

import com.adflow.auction.app.AuctionService
import com.adflow.auction.config.demoSettings
import com.adflow.auction.config.toScatterGather
import com.adflow.auction.http.auctionModule
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val service = AuctionService(demoSettings().toScatterGather())
    embeddedServer(Netty, port = port) { auctionModule(service) }.start(wait = true)
}
