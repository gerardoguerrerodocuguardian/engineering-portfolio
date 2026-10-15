# TDD log

Four real red-green-refactor cycles from building this service, in the order they happened.
Commands were run with `mvn -B test -Dtest=<class>`; the output excerpts are copied from those runs.
Notes on what did not go to plan are included on purpose.

## Cycle 1: invoice totals (percent discount, then tax)

**Red.** Created compiling stubs (`InvoiceCalculator.calculate` returned all zeros) and wrote one test with
hand-computed numbers: lines 100 x 100 + 5 x 500 = 12,500; 10% off = 1,250; 8.25% tax on 11,250 = 928.125, which
must round to 928.

```
Tests run: 1, Failures: 1 ... InvoiceCalculatorTest.sumsLinesAppliesPercentDiscountThenTax:21
expected: Money[cents=12500]
```

**Green.** The smallest thing that passes: a loop for the subtotal, an `instanceof PercentOff` branch, and
`(x * bps + 5000) / 10000` for half-up rounding in `long` arithmetic. Test passed.

**Refactor.** Not done in this cycle; it was driven by cycle 2.

## Cycle 2: fixed discount capped at subtotal, no discount

**Red.** Added three tests (fixed discount larger than the subtotal, smaller than the subtotal, no discount).

```
Tests run: 4, Failures: 2 ...
expected: Money[cents=200]  but was: Money[cents=0]
expected: Money[cents=1000] but was: Money[cents=0]
```

(The "no discount" test passed already, which is fine: it pinned existing behaviour and the half-up rounding.)

**Green + refactor.** Replaced the `instanceof` chain with a `switch` over the sealed `Discount` interface
(the compiler now proves every variant is handled), moved the rounding into `Money.percentOf(bps)`, made
`Money` reject negatives, and added input validation (empty lines, tax outside 0..10000 bps). Tests stayed green
through the refactor. A second refactor removed the double multiplication in `percentOf`.

Afterwards the example tests were complemented with jqwik properties
(`InvoicePropertiesTest`): `total = subtotal - discount + tax`, discount never above subtotal, tax within half a
cent of the exact value, monotonic in the tax rate, order independence. They passed first time, so no red phase
is claimed for them. Mutation testing (PIT) later pointed at one missing example, `times(0)`, which was then added
(see README, mutation score).

## Cycle 3: resilient tax-service client (WireMock)

**Red.** Wrote `HttpTaxRateClientTest` first, with six behaviours: happy path, retry on 5xx then success, give up
after `maxAttempts`, no retry for 404 (unknown region), read timeout, and circuit opening so that further calls do
not reach the server. The production class was a stub throwing `UnsupportedOperationException`.

```
Tests run: 6, Failures: 4, Errors: 2 ...
HttpTaxRateClientTest.returnsRateFromTaxService:38 » UnsupportedOperation not implemented
HttpTaxRateClientTest.doesNotRetryUnknownRegion:73
```

**Green.** `RestClient` with connect/read timeouts, `Retry(CircuitBreaker(call))` from Resilience4j; 404 mapped to
`UnknownRegionException` and excluded from both retry and breaker; `CallNotPermittedException` mapped to
`TaxServiceUnavailableException`. All 6 passed on the first implementation run. I chose the decoration order
deliberately (each attempt counted by the breaker); the circuit test would have failed with the opposite order.

**Refactor.** Later the ArchUnit layering test failed because the `api` package imported two exception classes from
`client` (see below); the exceptions moved to `domain`, and these tests only needed an import change.

## Cycle 4: voiding an invoice (REST + roles)

**Red.** In `InvoiceControllerTest` (`@WebMvcTest`) wrote `adminCanVoidAnIssuedInvoice` and
`voidingTwiceIs409Problem` before the endpoint existed. The domain rule (`InvoiceStatus.voided()`), the service
method and the `ROLE_ADMIN` security rule were already there; the controller method was not.

```
Tests run: 10, Failures: 2, Errors: 1 ...
InvoiceControllerTest.adminCanVoidAnIssuedInvoice:179   Status expected:<200> but was:<404>
InvoiceControllerTest.voidingTwiceIs409Problem:188      Status expected:<409> but was:<404>
InvoiceControllerTest.unknownRegionIs422AndTaxOutageIs503:132 » UnknownRegion
```

The third failure was a **bug in my test**, not in the product: re-stubbing a Mockito mock with
`given(mock.call()).willThrow(...)` invokes the previously stubbed throwing call. Fixed with
`willThrow(...).given(mock).call(...)`.

**Green.** Added `@PostMapping("/{id}/void")` delegating to the service; the existing `ApiExceptionHandler` maps
`InvalidStateTransitionException` to a 409 problem+json. 10/10 passed.

## What the safety net caught later

* ArchUnit (`LayeringTest`) failed: `api` depended on `client` exception types. The rule was right, the design was
  leaky, so the two exceptions were moved to `domain`.
* `InvoiceRepositoryTest` failed once in the full run because committed rows from an earlier `@SpringBootTest`
  shared the in-memory H2 database. The test now uses its own advertiser ids.
