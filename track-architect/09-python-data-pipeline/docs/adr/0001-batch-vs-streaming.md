# ADR 0001: Micro-batch instead of streaming for ad-event analytics

Status: accepted (for this project's analytics use case)

## Context

The analytics consumers (campaign CTR, spend, pacing, daily reports) tolerate minutes to hours of latency. Delivery is
at-least-once, events arrive late and duplicated, and the reports must be reproducible and restatable.
The streaming alternative is covered in [07-gcp-event-pipeline](../../../07-gcp-event-pipeline/README.md).

## Decision

Process files in micro-batches (for example every 5 to 60 minutes) with an idempotent upsert and aggregates recomputed from the
table. Use an event-time watermark only to label windows final or provisional, not to drop data.

## Consequences

- Positive: simple correctness (re-running a batch is safe), easy backfills, cheap local testing, one engine (DuckDB) for SQL and Parquet.
- Positive: late data is handled by recomputation, with restatements made visible.
- Negative: latency is bounded below by the batch interval; not suitable for real-time budget enforcement (that stays in the bidding path).
- Negative: recomputing whole tables does not scale forever; switch to incremental, partition-scoped recompute (by touched day) when volume demands it.

## Revisit when

Sub-minute freshness is required for a consumer, or volume makes full recompute too slow. At that point keep the same
contract and idempotency key and move the load step behind a streaming consumer.
