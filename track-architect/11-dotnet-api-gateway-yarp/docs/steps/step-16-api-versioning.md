# Step 16: API versioning with /api/v1 and /api/v2

## Why it matters

Versions are part of the public path and are mapped to the internal contract by YARP path transforms: `/api/v1/campaigns` becomes `/campaigns`, `/api/v2/campaigns` becomes `/v2/campaigns` (a response envelope). v1 carries `Deprecation` and `Sunset` response headers added by a response-header transform, so clients get a machine-readable retirement date without any code change in the service.

## What this step adds

- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `PathRemovePrefix` transforms and `ResponseHeader` transforms
- [`src/Services/Campaigns.Api/Program.cs`](../../src/Services/Campaigns.Api/Program.cs): `/campaigns` (v1) and `/v2/campaigns`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -s -D - $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" | grep -i -E 'sunset|deprecation'
curl -s $BASE/api/v2/campaigns -H "authorization: Bearer $TOKEN" | jq .meta
```

## What it mitigates

Breaking clients on contract changes, and un-announced retirement of old versions.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=16"` (VersioningTests: downstream sees `/campaigns` and `/v2/campaigns`; only v1 announces a sunset.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 15](step-15-metrics.md) | [Next: step 17](step-17-api-keys-and-quotas.md)
