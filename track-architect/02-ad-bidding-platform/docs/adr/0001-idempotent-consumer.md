# ADR 0001: Idempotent consumer with a persisted dedupe table

Status: accepted

## Context
`adflow.ad-events` is delivered at-least-once (rebalances, retries, producer resends). Re-applying an
event would double-charge a campaign budget.

## Decision
Every event id is inserted into `processed_event` (PK = `eventId`) in the same database transaction as the
budget update. A second delivery finds the row and is acknowledged without side effects. A racing duplicate
violates the PK, rolls back, and is deduped on redelivery.

## Consequences
- Correct under redelivery and consumer restarts; no dependency on broker exactly-once.
- The dedupe table grows: needs a retention job (events older than the max redelivery window).
- One extra indexed write per event.
