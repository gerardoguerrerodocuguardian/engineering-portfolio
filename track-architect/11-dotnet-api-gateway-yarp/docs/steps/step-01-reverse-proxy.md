# Step 1: Reverse proxy with YARP routes and clusters from configuration

## Why it matters

A gateway starts as a single, explicit door. Routes and clusters live in configuration (`ReverseProxy` section), so adding or changing an upstream is a reviewed config change, not a code change. Internal APIs are not published: in compose only the gateway has `ports:`, and the services sit on an `internal: true` network.

## What this step adds

- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddReverseProxy().LoadFromConfig(...)` and `MapReverseProxy()`
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `ReverseProxy:Routes` and `ReverseProxy:Clusters` (campaigns has two destinations, reports one)
- [`docker-compose.yml`](../../docker-compose.yml): services use `expose:` only; `internal` network
- [`src/Services/Campaigns.Api/Program.cs`](../../src/Services/Campaigns.Api/Program.cs): internal API that refuses calls without gateway identity headers

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
make run-local            # or: make certs && make up
curl -i http://127.0.0.1:8080/healthz
curl -i http://127.0.0.1:8080/internal/anything     # 404: no route, nothing is proxied
curl -i http://127.0.0.1:5101/campaigns             # run-local only: the service itself answers 401 (not via gateway)
```

## What it mitigates

Direct access to internal services (they are not on a published port), accidental exposure of unlisted paths (only configured routes are proxied), and drift between environments (routes are data).

## Test and checkpoint

- Tests: `dotnet test --filter "Step=01"` (ReverseProxyTests: Routes exist and the first request is proxied with the `/api/v1` prefix removed.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Next: step 02](step-02-jwt-authentication.md)
