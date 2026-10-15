# ADR 0001: Idempotency in two layers, with the sink as the authority

Status: accepted

## Context
Pub/Sub (and Kafka) deliver at-least-once. Exactly-once delivery on Pub/Sub is regional, pull-only and
can still redeliver when an ack fails or expires. Producers can also publish the same event twice, which no
broker setting can detect.

## Decision
1. `DedupeStore` (bounded in-memory cache): cheap fast path, avoids a BigQuery job for obvious replays.
2. `AggregateSink.write` is idempotent by contract: raw events are inserted only if `event_id` is absent
   (`MERGE ... WHEN NOT MATCHED`), and aggregates are *recomputed* for the touched campaign/day, never incremented.
   One contract test suite runs against the in-memory and DuckDB sinks; the same SQL shape is used in BigQuery.

## Consequences
- Cache loss on restart or scale-out is harmless; correctness never depends on it.
- Late or replayed events converge to the same aggregate; a backfill is "replay the topic".
- Recompute cost is bounded by partition and cluster pruning (see `sql/`), not by table size.
- Per-message MERGE is expensive: production should micro-batch (the port already takes a list).
