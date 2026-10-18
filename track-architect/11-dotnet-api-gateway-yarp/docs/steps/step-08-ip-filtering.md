# Step 8: IP allowlist and denylist with CIDR

## Why it matters

Some callers should never get in (denylist) and some surfaces should only be reachable from known networks (admin allowlist). Both accept CIDR ranges and IPv6, matching is done on the address after trusted forwarded-header processing, and an unknown address is never treated as an admin address (fail closed).

## What this step adds

- [`src/Gateway/Infrastructure/IpPolicy.cs`](../../src/Gateway/Infrastructure/IpPolicy.cs): parsed `IPNetwork` lists cached per options instance
- [`src/Gateway/Middleware/IpFilterMiddleware.cs`](../../src/Gateway/Middleware/IpFilterMiddleware.cs): deny, optional global allow, admin path allowlist
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `Gateway:IpFilter` (`Deny`, `Allow`, `AdminAllow`)

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -i $BASE/admin/stats -H "authorization: Bearer $ROOT"   # 200 from an allowlisted address, 403 from anywhere else
```
Networks must be written in canonical form (`10.0.0.0/8`, not `10.1.2.3/8`).

## What it mitigates

Access to management endpoints from the internet, known-bad address ranges, and lateral movement from unexpected networks.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=08"` (IpFilterTests: denied CIDR, admin blocked from outside even with an admin token, and audited admin changes.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 07](step-07-tls-and-secure-headers.md) | [Next: step 09](step-09-timeouts.md)
