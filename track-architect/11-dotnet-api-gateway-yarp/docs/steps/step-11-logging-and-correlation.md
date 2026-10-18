# Step 11: Structured logging and W3C trace-context correlation

## Why it matters

Logs are JSON (built-in console JSON formatter) with scopes carrying `TraceId` and `ClientIp`. The gateway honours an incoming `traceparent`, otherwise starts a trace, returns the trace id as `X-Correlation-Id`, and a YARP request transform forwards `traceparent` to the upstream so one id follows the request across hops.

## What this step adds

- [`src/Gateway/Middleware/CorrelationMiddleware.cs`](../../src/Gateway/Middleware/CorrelationMiddleware.cs): trace start/continue, response header, log scope
- [`src/Gateway/Middleware/ObservabilityMiddleware.cs`](../../src/Gateway/Middleware/ObservabilityMiddleware.cs): one structured request line per call (path only, never the query string or tokens)
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddJsonConsole`, the `traceparent` request transform

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -si $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' | grep -i correlation
```

## What it mitigates

Un-debuggable incidents, and (by logging paths without query strings or credentials) accidental secret leakage into logs.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=11"` (CorrelationTests: the id is echoed and the downstream saw the same trace id; a trace is created when none is sent.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 10](step-10-health-checks.md) | [Next: step 12](step-12-security-audit-log.md)
