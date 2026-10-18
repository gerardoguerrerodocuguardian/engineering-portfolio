# Step 15: Metrics with OpenTelemetry and Prometheus (admin only)

## Why it matters

ASP.NET Core and HttpClient instrumentation, the YARP meter and the gateway's own counters (`adflow.gateway.rejected`, `.bans`, `.waf.matches`) are exposed at `/admin/metrics` in Prometheus format. The endpoint is behind the admin IP allowlist and the `admin` role because metrics reveal topology and traffic. Sample alert rules are in `ops/prometheus/alerts.yml`. Traces are exported through OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## What this step adds

- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddOpenTelemetry`, `AddPrometheusExporter`, the admin guard in front of the scrape endpoint
- [`src/Gateway/Infrastructure/GatewayMetrics.cs`](../../src/Gateway/Infrastructure/GatewayMetrics.cs): custom counters
- [`ops/prometheus/prometheus.yml`](../../ops/prometheus/prometheus.yml): scrape config with a bearer token file
- [`ops/prometheus/alerts.yml`](../../ops/prometheus/alerts.yml): 5xx ratio, p99 latency, rate-limit and 401 spikes, bans, WAF matches

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -s $BASE/admin/metrics -H "authorization: Bearer $ROOT" | head -30
docker compose --profile observability up -d     # Prometheus on :9090 (needs ops/prometheus/token)
```

## What it mitigates

Blind operation: you cannot defend or capacity-plan what you cannot see. Also prevents the metrics endpoint itself from leaking internals.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=15"` (MetricsTests: outsider 403, anonymous 401, non-admin 403, admin 200.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 14](step-14-retry-and-circuit-breaker.md) | [Next: step 16](step-16-api-versioning.md)
