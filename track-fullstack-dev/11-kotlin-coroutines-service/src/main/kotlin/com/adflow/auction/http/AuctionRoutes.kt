package com.adflow.auction.http

import com.adflow.auction.app.AuctionService
import com.adflow.auction.domain.AuctionRequest
import com.adflow.auction.domain.AuctionResult
import com.adflow.auction.domain.Money
import com.adflow.auction.domain.ProviderOutcome
import com.adflow.auction.domain.SlotId
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class AuctionRequestDto(
    val slotId: String,
    val floorCents: Long = 0,
)

@Serializable
data class BidDto(
    val provider: String,
    val campaignId: String,
    val bidCents: Long,
)

@Serializable
data class UnavailableDto(
    val provider: String,
    val reason: String,
)

@Serializable
data class AuctionResponseDto(
    val status: String,
    val winner: BidDto? = null,
    val clearingPriceCents: Long? = null,
    val participants: Int = 0,
    val unavailable: List<UnavailableDto> = emptyList(),
)

@Serializable
data class ProblemDto(
    val title: String,
    val status: Int,
    val detail: String,
)

/** Boundary validation as a value: no exceptions for invalid user input. */
sealed interface Validated {
    data class Valid(
        val request: AuctionRequest,
    ) : Validated

    data class Invalid(
        val detail: String,
    ) : Validated
}

fun AuctionRequestDto.validate(): Validated {
    if (slotId.isBlank()) return Validated.Invalid("slotId must not be blank")
    val floor = Money.ofCents(floorCents) ?: return Validated.Invalid("floorCents must be >= 0")
    return Validated.Valid(AuctionRequest(SlotId(slotId), floor))
}

private fun ProviderOutcome.Unavailable.toDto(): UnavailableDto =
    when (this) {
        is ProviderOutcome.TimedOut -> UnavailableDto(provider.value, "TIMEOUT")
        is ProviderOutcome.Failed -> UnavailableDto(provider.value, "ERROR")
    }

fun AuctionResult.toDto(): AuctionResponseDto =
    when (this) {
        is AuctionResult.Won ->
            AuctionResponseDto(
                status = "WON",
                winner = BidDto(winner.provider.value, winner.campaign.value, winner.price.cents),
                clearingPriceCents = clearingPrice.cents,
                participants = participants,
                unavailable = unavailable.map { it.toDto() },
            )
        is AuctionResult.NoWinner ->
            AuctionResponseDto(status = "NO_WINNER", unavailable = unavailable.map { it.toDto() })
    }

fun Application.auctionModule(service: AuctionService) {
    install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    install(StatusPages) {
        exception<BadRequestException> { call, _ ->
            call.respond(HttpStatusCode.BadRequest, ProblemDto("Bad Request", 400, "malformed request body"))
        }
    }
    routing {
        get("/healthz") { call.respond(mapOf("status" to "UP")) }
        post("/v1/auction") {
            when (val v = call.receive<AuctionRequestDto>().validate()) {
                is Validated.Invalid ->
                    call.respond(HttpStatusCode.BadRequest, ProblemDto("Bad Request", 400, v.detail))
                is Validated.Valid -> call.respond(service.run(v.request).toDto())
            }
        }
    }
}
