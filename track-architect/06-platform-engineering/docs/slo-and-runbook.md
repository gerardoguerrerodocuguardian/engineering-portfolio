# SLOs and sample runbook (fictional AdFlow)

## SLOs for `POST /v1/bids`
| SLI | Objective | Window |
|---|---|---|
| Availability: non-5xx / all requests | 99.9% (budget 43m of full outage) | 30 days |
| Latency: requests faster than 300 ms | 95% | 30 days |

Alerts (see `observability/prometheus/alerts.yml`) use multi-window burn rates: 14.4x over 5m and 1h pages, 6x over 30m and 6h pages.
Latency below objective opens a ticket, not a page.

## Runbook

### High error rate
1. Open the Grafana "AdFlow RED metrics" dashboard; find the service and the status codes.
2. Check recent deploys: `helm history <release>`; roll back with `helm rollback <release> <rev>` if correlated.
3. Check dependencies (PostgreSQL, Kafka) health and connection pool saturation in logs (Loki: `{service="..."} |= "ERROR"`).
4. Follow a failing trace in Tempo from the exemplar.
5. Mitigate (rollback, scale up, shed load), then write a post-incident review.

### High latency
1. Compare p50/p95/p99; a p99-only rise suggests a slow dependency or GC pauses.
2. Check HPA (`kubectl get hpa`) is not pinned at max and CPU throttling is absent.
3. Check pod restarts/OOMKills: `kubectl describe pod`.
4. Scale out or raise limits temporarily; open a ticket for root cause.
