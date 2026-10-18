# Step 5: Adaptive abuse protection: temporary IP bans

## Why it matters

Rate limits are static; attackers adapt. After N rejected requests (401/403/429 by default) inside a window, the offending IP is banned for a period and gets `403` plus `Retry-After`. The store sits behind `IAbuseStore`: in-memory here, with a documented Redis shape for several replicas. Admin networks are exempt so operators cannot lock themselves out, and a banned client cannot extend its own ban by retrying.

## What this step adds

- [`src/Gateway/Abuse/AbuseStore.cs`](../../src/Gateway/Abuse/AbuseStore.cs): `IAbuseStore` + `InMemoryAbuseStore` (sliding failure window, expiring bans)
- [`src/Gateway/Abuse/AbuseTracker.cs`](../../src/Gateway/Abuse/AbuseTracker.cs): threshold logic, audit event, metric
- [`src/Gateway/Middleware/ObservabilityMiddleware.cs`](../../src/Gateway/Middleware/ObservabilityMiddleware.cs): feeds every rejected response into the tracker
- [`src/Gateway/Middleware/BanMiddleware.cs`](../../src/Gateway/Middleware/BanMiddleware.cs): enforces active bans early in the pipeline

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
make abuse     # 14 bad-token requests: 401 ... then 403 with retry-after
```
Redis variant (not implemented): `INCR abuse:fail:{ip}` + `EXPIRE` for the window, `SET abuse:ban:{ip} 1 EX {seconds}` for the ban, so every replica sees the same state.

## What it mitigates

Credential stuffing, token guessing, vulnerability scanners and slow-burn probing that stays just under static rate limits.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=05"` (AbuseProtectionTests: three failures lead to a ban that even a valid token cannot bypass, an admin lifts it, and bans expire.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 04](step-04-rate-limiting.md) | [Next: step 06](step-06-request-validation.md)
