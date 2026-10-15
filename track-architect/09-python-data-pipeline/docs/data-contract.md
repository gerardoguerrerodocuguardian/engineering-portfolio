# Data contract

Source of truth: [`shared/contracts/ad-events.asyncapi.yaml`](../../../shared/contracts/ad-events.asyncapi.yaml)
(`AdImpression`, `AdClick`). Delivery is at-least-once, so `eventId` is the idempotency key.

## Input (JSONL, one event per line)

| Field | Type | Rule enforced by `AdEvent` |
|---|---|---|
| `eventId` | string (uuid) | required, valid UUID, unique key |
| `type` | string | required, `IMPRESSION` or `CLICK` |
| `campaignId` | string | required, 1-64 chars of `[A-Za-z0-9_-]` |
| `costCents` | integer | required, strict integer (`"12"` is rejected), `>= 0` |
| `occurredAt` | date-time | required, timezone-aware (naive timestamps are rejected) |
| `ingestedAt` | date-time | optional pipeline envelope field (arrival time); defaults to `occurredAt` |

Unknown fields are ignored for loading but counted as **schema drift** (`schema_drift` metric).

## Outputs

| Artifact | Grain | Notes |
|---|---|---|
| `ad_events` (DuckDB) | one row per `event_id` | timestamps are naive UTC; earliest `ingested_at` kept |
| `parquet/ad_events/day=*/` | event day | same columns plus `day` |
| `hourly_campaign_metrics` | campaign x hour | impressions, clicks, spend_cents, late_events, ctr, is_final, cum_spend_cents, pacing_ratio |
| `daily_campaign_metrics` | campaign x day | adds budget_utilization |
| `quarantine/rejected.jsonl` | rejected input line | `lineNo`, `reason`, `raw` |

## Definitions

- **CTR** = clicks / impressions (null when there are no impressions).
- **Spend** = sum of `costCents` over impressions and clicks.
- **Late event**: `ingestedAt - occurredAt` greater than the allowed lateness (2 hours by default).
- **Pacing ratio** = cumulative spend that day / (daily budget x (hour + 1) / 24). Budgets are synthetic (`daily_budget_cents`).
- **Final window**: hour whose end is at or before the watermark.

## Quality expectations (default checks)

See `DEFAULT_CHECKS` in `src/adflow_pipeline/dq.py`: volume, quarantine rate, null rate, duplicate rate, late rate,
freshness and schema drift. Changing a field type or removing a required field is a breaking change: bump the contract version first.
