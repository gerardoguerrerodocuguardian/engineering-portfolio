# Step 18: Response caching for safe GETs (output caching)

## Why it matters

Caching GETs at the gateway removes load from services. The built-in output-cache policy refuses requests with `Authorization`, so a custom policy opts in explicitly and varies the key by caller identity, host and full query string: one user can never receive another user's cached response. Only `200` responses without `Set-Cookie` are stored, with a short TTL, and only GET.

## What this step adds

- [`src/Gateway/Caching/SafeGetCachePolicy.cs`](../../src/Gateway/Caching/SafeGetCachePolicy.cs): the policy
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `OutputCachePolicy: safe-get` on read routes; `Gateway:Cache`
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddOutputCache`, `UseOutputCache` after authorization

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -s -o /dev/null $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN"
curl -s -o /dev/null $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN"   # served from the gateway; the service logs one request
```

## What it mitigates

Load amplification, and (by design) cross-user data leaks through shared caches, a classic gateway caching bug.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=18"` (CachingTests: second GET does not reach the backend; a different user gets its own entry.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 17](step-17-api-keys-and-quotas.md) | [Next: step 19](step-19-admin-endpoints.md)
