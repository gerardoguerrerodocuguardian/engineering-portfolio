# Step 9: Timeouts

## Why it matters

A slow dependency must not hold gateway resources forever. Three layers: YARP `HttpRequest.ActivityTimeout` per cluster (no bytes moving), a per-route `Timeout`, and a named `TimeoutPolicy` (`reports`) for slower endpoints. A 504 is returned instead of hanging connections.

## What this step adds

- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `ActivityTimeout`, route `Timeout`, `TimeoutPolicy`
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddRequestTimeouts`, `RequestTimeoutOptions` from `Gateway:Timeouts`, `UseRequestTimeouts`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -i "$BASE/api/v1/reports/slow?delayMs=5000" -H "authorization: Bearer $BOB"
```

## What it mitigates

Slowloris-style resource exhaustion, thread/connection pile-ups behind a slow upstream, and cascading latency.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=09"` (TimeoutTests: a 5 s backend with a 1 s activity timeout returns 504 well before 4 s.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 08](step-08-ip-filtering.md) | [Next: step 10](step-10-health-checks.md)
