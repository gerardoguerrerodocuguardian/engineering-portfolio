# Step 19: Minimal admin endpoints with audit

## Why it matters

Operators need to see and change gateway state: list bans, unblock or ban an address, view stats and the audit trail, and reload configuration (routes, clusters and limits apply without a restart). The surface is small and guarded three times: IP allowlist, `admin` role, and an audit event for each change.

## What this step adds

- [`src/Gateway/Endpoints/AdminEndpoints.cs`](../../src/Gateway/Endpoints/AdminEndpoints.cs): `/admin/blocked`, `/admin/stats`, `/admin/audit`, `/admin/reload`
- [`src/Gateway/Middleware/IpFilterMiddleware.cs`](../../src/Gateway/Middleware/IpFilterMiddleware.cs): admin path allowlist

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -s $BASE/admin/blocked -H "authorization: Bearer $ROOT"
curl -s -XDELETE $BASE/admin/blocked/198.51.100.50 -H "authorization: Bearer $ROOT"
curl -s -XPOST $BASE/admin/reload -H "authorization: Bearer $ROOT"
```

## What it mitigates

Un-reviewed manual changes (everything is audited) and admin takeover from the internet (network + role gates).

## Test and checkpoint

- Tests: `dotnet test --filter "Step=19"` (AbuseProtectionTests / IpFilterTests: unban through the admin API; ban and reload audited.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 18](step-18-response-caching.md) | [Next: step 20](step-20-waf-integration.md)
