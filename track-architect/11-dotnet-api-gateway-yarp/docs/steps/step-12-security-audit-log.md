# Step 12: Security audit log of rejected access and admin changes

## Why it matters

Request logs answer "what happened"; an audit trail answers "who tried what and who changed what". Audit events use their own category (`AdFlow.Audit`), an optional JSON-lines file sink (`Gateway:Audit:FilePath`) and an in-memory ring served by the admin API. Every rejected response and every admin action produces one, without the components having to remember to log.

## What this step adds

- [`src/Gateway/Audit/AuditLog.cs`](../../src/Gateway/Audit/AuditLog.cs): `AuditEvent`, ring buffer, file sink
- [`src/Gateway/Middleware/ObservabilityMiddleware.cs`](../../src/Gateway/Middleware/ObservabilityMiddleware.cs): audits all rejected statuses with a reason
- [`src/Gateway/Endpoints/AdminEndpoints.cs`](../../src/Gateway/Endpoints/AdminEndpoints.cs): audit on ban, unban and reload

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -s $BASE/admin/audit?take=5 -H "authorization: Bearer $ROOT" | jq .   # from an allowlisted address
```

## What it mitigates

Repudiation and undetected probing: you can reconstruct attacks and prove admin actions after the fact.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=12"` (AuditTests: a rejected request appears in the audit trail with the caller's address.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 11](step-11-logging-and-correlation.md) | [Next: step 13](step-13-load-balancing.md)
