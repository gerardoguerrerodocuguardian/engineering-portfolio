package com.adflow.auction

import com.adflow.auction.domain.AuctionResult
import com.adflow.auction.domain.ProviderId
import com.adflow.auction.domain.ProviderOutcome
import com.adflow.auction.domain.SecondPriceAuction
import com.adflow.auction.domain.cents
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll

private fun responded(vararg bids: Pair<String, Long>) = bids.map { (p, c) -> ProviderOutcome.Responded(bid(p, c)) }

private fun won(result: AuctionResult) = result.shouldBeInstanceOf<AuctionResult.Won>()

class SecondPriceAuctionTest :
    FunSpec({
        test("highest bid wins and pays the second-highest price") {
            val r = won(SecondPriceAuction.decide(0.cents, responded("a" to 300, "b" to 500, "c" to 400)))
            r.winner.provider shouldBe ProviderId("b")
            r.clearingPrice shouldBe 400.cents
            r.participants shouldBe 3
        }

        test("a lone bidder pays the floor") {
            val r = won(SecondPriceAuction.decide(120.cents, responded("a" to 500)))
            r.clearingPrice shouldBe 120.cents
        }

        test("bids below the floor are ignored and do not set the price") {
            val r = won(SecondPriceAuction.decide(200.cents, responded("a" to 500, "b" to 150, "c" to 300)))
            r.winner.provider shouldBe ProviderId("a")
            r.clearingPrice shouldBe 300.cents
            r.participants shouldBe 2
        }

        test("a bid exactly at the floor is eligible") {
            won(SecondPriceAuction.decide(100.cents, responded("a" to 100))).clearingPrice shouldBe 100.cents
        }

        test("ties go to the lowest provider id and pay the tied price") {
            val r = won(SecondPriceAuction.decide(0.cents, responded("z" to 400, "m" to 400)))
            r.winner.provider shouldBe ProviderId("m")
            r.clearingPrice shouldBe 400.cents
        }

        test("no eligible bid yields NoWinner and keeps the unavailable providers") {
            val outcomes =
                responded("a" to 10) +
                    ProviderOutcome.TimedOut(ProviderId("t")) +
                    ProviderOutcome.Declined(ProviderId("d"))
            val r = SecondPriceAuction.decide(50.cents, outcomes).shouldBeInstanceOf<AuctionResult.NoWinner>()
            r.unavailable shouldContainExactly listOf(ProviderOutcome.TimedOut(ProviderId("t")))
        }

        context("properties") {
            val prices = Arb.list(Arb.long(0L..1_000L), 0..12)
            val floors = Arb.long(0L..1_000L)

            fun outcomes(ps: List<Long>) = ps.mapIndexed { i, p -> ProviderOutcome.Responded(bid("p$i", p)) }

            test("winner has the maximum eligible bid; clearing price is within [floor, winning bid]") {
                checkAll(prices, floors) { ps, floor ->
                    val eligible = ps.filter { it >= floor }
                    when (val r = SecondPriceAuction.decide(floor.cents, outcomes(ps))) {
                        is AuctionResult.NoWinner -> eligible.isEmpty() shouldBe true
                        is AuctionResult.Won -> {
                            r.winner.price.cents shouldBe eligible.max()
                            (r.clearingPrice.cents <= r.winner.price.cents) shouldBe true
                            (r.clearingPrice.cents >= floor) shouldBe true
                            r.participants shouldBe eligible.size
                        }
                    }
                }
            }

            test("clearing price equals the second-highest eligible bid, or the floor when alone") {
                checkAll(prices, floors) { ps, floor ->
                    val sorted = ps.filter { it >= floor }.sortedDescending()
                    val r = SecondPriceAuction.decide(floor.cents, outcomes(ps))
                    if (sorted.isNotEmpty()) {
                        won(r).clearingPrice.cents shouldBe (sorted.getOrNull(1) ?: floor)
                    }
                }
            }

            test("result does not depend on arrival order") {
                checkAll(prices, floors) { ps, floor ->
                    val base = outcomes(ps)
                    val shuffled = base.shuffled(kotlin.random.Random(ps.hashCode()))
                    SecondPriceAuction.decide(floor.cents, shuffled) shouldBe
                        SecondPriceAuction.decide(floor.cents, base)
                }
            }

            test("truthfulness: raising the winning bid never changes the price paid") {
                checkAll(prices, floors, Arb.long(1L..500L)) { ps, floor, raise ->
                    val first = SecondPriceAuction.decide(floor.cents, outcomes(ps))
                    if (first is AuctionResult.Won) {
                        val raised =
                            outcomes(ps).map {
                                if (it.bid ==
                                    first.winner
                                ) {
                                    ProviderOutcome.Responded(
                                        bid(
                                            it.bid.provider.value,
                                            it.bid.price.cents + raise,
                                        ),
                                    )
                                } else {
                                    it
                                }
                            }
                        val second = won(SecondPriceAuction.decide(floor.cents, raised))
                        second.winner.provider shouldBe first.winner.provider
                        second.clearingPrice shouldBe first.clearingPrice
                    }
                }
            }

            test("adding a bid below the current clearing price changes neither winner nor price") {
                checkAll(prices, floors) { ps, floor ->
                    val first = SecondPriceAuction.decide(floor.cents, outcomes(ps))
                    if (first is AuctionResult.Won && first.clearingPrice.cents > 0) {
                        val extra = ProviderOutcome.Responded(bid("zz-extra", first.clearingPrice.cents - 1))
                        val second = won(SecondPriceAuction.decide(floor.cents, outcomes(ps) + extra))
                        second.winner shouldBe first.winner
                        second.clearingPrice shouldBe first.clearingPrice
                    }
                }
            }
        }
    })
