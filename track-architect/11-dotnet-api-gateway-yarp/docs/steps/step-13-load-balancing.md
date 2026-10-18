# Step 13: Load balancing across two instances

## Why it matters

The campaigns cluster has two destinations. `PowerOfTwoChoices` picks two random healthy destinations and sends the request to the less loaded one, which avoids both the herd behaviour of least-requests and the blindness of round-robin. `RoundRobin` is configured for reports. Session affinity is deliberately not enabled: the APIs are stateless. If you ever need it, add `SessionAffinity: { Enabled: true, Policy: Cookie }` to the cluster plus a shared Data Protection key ring across gateway replicas.

## What this step adds

- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `LoadBalancingPolicy` per cluster, two campaigns destinations
- [`docker-compose.yml`](../../docker-compose.yml): `campaigns-1` and `campaigns-2` from the same image

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
for i in $(seq 1 8); do curl -s -D - -o /dev/null $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" | grep -i x-served-by; done
```

## What it mitigates

Capacity exhaustion on one replica and a single point of failure.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=13"` (LoadBalancingTests: six requests with `RoundRobin` split 3/3 across the instances.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 12](step-12-security-audit-log.md) | [Next: step 14](step-14-retry-and-circuit-breaker.md)
