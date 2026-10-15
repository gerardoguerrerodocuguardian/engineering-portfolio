package com.adflow.auction

import com.adflow.auction.app.ScatterGather
import com.adflow.auction.domain.ProviderId
import com.adflow.auction.domain.ProviderOutcome
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class ScatterGatherTest :
    FunSpec({
        test("a slow provider times out in virtual time while the others still answer") {
            runTest {
                val gather =
                    ScatterGather(
                        listOf(
                            FakeProvider("fast", latency = 10.milliseconds),
                            FakeProvider("slow", latency = 10.seconds),
                        ),
                        maxParallel = 2,
                        perCallTimeout = 100.milliseconds,
                    )
                val outcomes = gather.gather(request())
                outcomes.map { it.provider.value to it::class.simpleName } shouldContainExactlyInAnyOrder
                    listOf("fast" to "Responded", "slow" to "TimedOut")
                currentTime shouldBe 100 // no real waiting; the clock jumped to the timeout
            }
        }

        test("parallelism is bounded and the timeout clock starts when a call starts, not when it queues") {
            runTest {
                val tracker = Tracker()
                val providers = (1..5).map { FakeProvider("p$it", latency = 50.milliseconds, tracker = tracker) }
                val outcomes =
                    ScatterGather(providers, maxParallel = 2, perCallTimeout = 60.milliseconds)
                        .gather(request())
                tracker.max.get() shouldBe 2
                // the 3rd call waited 50ms in the queue and still did not time out
                outcomes.all { it is ProviderOutcome.Responded } shouldBe true
                currentTime shouldBe 150 // ceil(5/2) waves of 50ms
            }
        }

        test("a failing provider becomes Failed and does not poison the others") {
            runTest {
                val gather =
                    ScatterGather(
                        listOf(FakeProvider("ok"), FakeProvider("boom") { error("kaput") }),
                        maxParallel = 4,
                        perCallTimeout = 100.milliseconds,
                    )
                val failed = gather.gather(request()).filterIsInstance<ProviderOutcome.Failed>().single()
                failed.provider shouldBe ProviderId("boom")
                failed.reason shouldBe "kaput"
            }
        }

        test("a declining provider is a Declined outcome") {
            runTest {
                val out = ScatterGather(listOf(FakeProvider("no") { null }), 1, 100.milliseconds).gather(request())
                out.single().shouldBeInstanceOf<ProviderOutcome.Declined>()
            }
        }

        test("cancelling the caller cancels in-flight provider calls and is not turned into an outcome") {
            runTest {
                val tracker = Tracker()
                var sawCancellation = false
                val hanging =
                    FakeProvider("hang", tracker = tracker) {
                        try {
                            awaitCancellation()
                        } catch (e: CancellationException) {
                            sawCancellation = true
                            throw e
                        }
                    }
                val job = launch { ScatterGather(listOf(hanging), 1, 10.seconds).gather(request()) }
                runCurrent()
                job.cancelAndJoin()
                sawCancellation shouldBe true
                job.isCancelled shouldBe true
                currentTime shouldBe 0
            }
        }

        test("empty provider list gathers nothing") {
            runTest {
                ScatterGather(emptyList(), 1, 1.seconds).gather(request()) shouldBe emptyList()
            }
        }

        test("invalid configuration is rejected") {
            runTest {
                val r = runCatching { ScatterGather(emptyList(), 0, 1.seconds) }
                r.exceptionOrNull().shouldBeInstanceOf<IllegalArgumentException>()
            }
        }
    })
