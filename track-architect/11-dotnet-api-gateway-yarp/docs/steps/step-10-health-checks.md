# Step 10: Active and passive health checks

## Why it matters

Active checks poll `/healthz` on each destination; passive checks watch real traffic for transport failures. Unhealthy destinations leave the rotation and are re-tried after a reactivation period, so one bad replica does not turn into user-visible errors.

## What this step adds

- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `HealthCheck.Active` (ConsecutiveFailures) and `HealthCheck.Passive` (TransportFailureRate) per cluster
- [`src/Services/Campaigns.Api/Program.cs`](../../src/Services/Campaigns.Api/Program.cs): `/healthz`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
docker compose stop campaigns-1
for i in 1 2 3 4 5 6; do curl -s -D - -o /dev/null $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" | grep -i x-served-by; done
```

## What it mitigates

Single-instance failure becoming an outage, and traffic being sent to replicas that are up but broken.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=10"` (HealthCheckTests: active check converges on the healthy instance; killing an instance converges via the passive check.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 09](step-09-timeouts.md) | [Next: step 11](step-11-logging-and-correlation.md)
