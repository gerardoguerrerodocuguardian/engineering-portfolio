package com.adflow.auction

import com.adflow.auction.adapter.Behavior
import com.adflow.auction.app.AuctionService
import com.adflow.auction.config.auctionSettings
import com.adflow.auction.config.toScatterGather
import com.adflow.auction.domain.cents
import com.adflow.auction.http.auctionModule
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration.Companion.milliseconds

private fun ApplicationTestBuilder.jsonClient() = createClient { install(ContentNegotiation) { json() } }

private val settings =
    auctionSettings {
        maxParallel = 2
        perCallTimeout = 100.milliseconds
        providers {
            simulated("alpha") {
                basePrice = 300.cents
                spreadCents = 0
                latency = 1.milliseconds
            }
            simulated("bravo") {
                basePrice = 500.cents
                spreadCents = 0
                latency = 1.milliseconds
            }
            simulated("charlie") {
                basePrice = 400.cents
                spreadCents = 0
                latency = 1.milliseconds
            }
            simulated("slow") { behavior = Behavior.Hangs }
            simulated("broken") { behavior = Behavior.Fails }
            simulated("shy") {
                behavior = Behavior.Declines
                latency = 1.milliseconds
            }
        }
    }

class AuctionApiTest :
    FunSpec({
        fun app(block: suspend ApplicationTestBuilder.() -> Unit) =
            testApplication {
                application { auctionModule(AuctionService(settings.toScatterGather())) }
                block()
            }

        test("POST /v1/auction returns the winner, second price, and degraded providers") {
            app {
                val res =
                    jsonClient().post("/v1/auction") {
                        contentType(ContentType.Application.Json)
                        setBody("""{"slotId":"home-top","floorCents":100}""")
                    }
                res.status shouldBe HttpStatusCode.OK
                val body: JsonObject = Json.parseToJsonElement(res.bodyAsText()).jsonObject
                body["status"]!!.jsonPrimitive.content shouldBe "WON"
                body["winner"]!!.jsonObject["provider"]!!.jsonPrimitive.content shouldBe "bravo"
                body["winner"]!!.jsonObject["bidCents"]!!.jsonPrimitive.int shouldBe 500
                body["clearingPriceCents"]!!.jsonPrimitive.int shouldBe 400
                body["participants"]!!.jsonPrimitive.int shouldBe 3
                body["unavailable"]!!
                    .jsonArray
                    .map {
                        it.jsonObject["provider"]!!.jsonPrimitive.content to
                            it.jsonObject["reason"]!!.jsonPrimitive.content
                    }.toSet() shouldBe setOf("slow" to "TIMEOUT", "broken" to "ERROR")
            }
        }

        test("a floor above every bid yields NO_WINNER with 200") {
            app {
                val res =
                    jsonClient().post("/v1/auction") {
                        contentType(ContentType.Application.Json)
                        setBody("""{"slotId":"home-top","floorCents":9999}""")
                    }
                res.status shouldBe HttpStatusCode.OK
                Json
                    .parseToJsonElement(res.bodyAsText())
                    .jsonObject["status"]!!
                    .jsonPrimitive.content shouldBe "NO_WINNER"
            }
        }

        test("invalid input is a 400 problem, not a 500") {
            app {
                val client = jsonClient()
                for (payload in listOf(
                    """{"slotId":" ","floorCents":1}""",
                    """{"slotId":"s","floorCents":-5}""",
                    "not json",
                )) {
                    val res =
                        client.post("/v1/auction") {
                            contentType(ContentType.Application.Json)
                            setBody(payload)
                        }
                    res.status shouldBe HttpStatusCode.BadRequest
                }
            }
        }

        test("health endpoint is up") {
            app {
                val res = jsonClient().get("/healthz")
                res.status shouldBe HttpStatusCode.OK
            }
        }
    })
