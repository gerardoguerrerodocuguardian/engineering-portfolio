# Step 14: Retry and circuit breaker for idempotent GETs (how YARP integrates)

## Why it matters

Be precise about the integration: YARP does not use `IHttpClientFactory`, so `Microsoft.Extensions.Http.Resilience` handlers cannot just be attached to a named client. YARP lets you supply its `HttpMessageInvoker` through `IForwarderHttpClientFactory`; we build one with a `DelegatingHandler` that runs a Polly v8 pipeline (retry with jittered backoff, then a circuit breaker per destination) for GET/HEAD requests without a body only. Retries go back to the same destination (YARP has already chosen it); moving traffic to another replica is the health checks' and load balancer's job. An open circuit answers `503` + `Retry-After` immediately instead of hammering a sick instance.

## What this step adds

- [`src/Gateway/Proxy/IdempotentResilienceHandler.cs`](../../src/Gateway/Proxy/IdempotentResilienceHandler.cs): retry + breaker, GET/HEAD only, per-destination state
- [`src/Gateway/Proxy/GatewayForwarderHttpClientFactory.cs`](../../src/Gateway/Proxy/GatewayForwarderHttpClientFactory.cs): hardened `SocketsHttpHandler` wrapped by the handler
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddSingleton<IForwarderHttpClientFactory, ...>` after `AddReverseProxy`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

Tested at the handler level with a stub downstream (no network needed): `dotnet test --filter Step=14`.

## What it mitigates

Transient upstream blips (retry), retry storms and cascading failure (the breaker stops traffic to a failing instance and gives it time to recover). Non-idempotent calls are never replayed.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=14"` (ResilienceHandlerTests: GET retried 3 times, POST once, breaker opens and short-circuits, breakers are per destination.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 13](step-13-load-balancing.md) | [Next: step 15](step-15-metrics.md)
