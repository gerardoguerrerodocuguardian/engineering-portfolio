# Step 17: API keys and daily quotas per client application

## Why it matters

Machine clients (partners) get API keys, not user tokens. Keys look like `<clientId>.<secret>`; only a SHA-256 hash is in configuration (a fast hash is fine for high-entropy random keys, unlike passwords), comparison is constant-time, and several hashes per client allow rotation. Each client has scopes and a daily quota enforced after authorization, answering `429` + `Retry-After` until midnight UTC with `X-Quota-*` headers. The key itself is stripped before the request reaches the service.

## What this step adds

- [`src/Gateway/Security/ApiKeyAuthentication.cs`](../../src/Gateway/Security/ApiKeyAuthentication.cs): handler, `IQuotaStore`, in-memory store
- [`src/Gateway/Middleware/ApiKeyQuotaMiddleware.cs`](../../src/Gateway/Middleware/ApiKeyQuotaMiddleware.cs): quota enforcement
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `Gateway:ApiKeys:Clients` (demo key `orbit.demo-key-change-me`, a documented placeholder)

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -i $BASE/api/v1/campaigns -H 'X-Api-Key: orbit.demo-key-change-me'      # X-Quota-Remaining: 999
```
Generate a real key and hash: `KEY="orbit.$(openssl rand -hex 24)"; printf %s "$KEY" | shasum -a 256`. Keep the key in your secret store, put only the hash in config.

## What it mitigates

Key theft impact (hashes only at rest, scoped, quota-limited), runaway partner integrations, and unfair resource sharing between partners.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=17"` (ApiKeyTests: quota exhaustion gives 429 with Retry-After, wrong keys give 401, key holders cannot write, the key is not forwarded.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 16](step-16-api-versioning.md) | [Next: step 18](step-18-response-caching.md)
