# ADR 0002: Transactional outbox for BudgetExhausted

Status: accepted

## Context
Exhausting a budget must update Postgres and publish to Kafka. A dual write can lose the message
(crash after commit) or announce a state that was rolled back.

## Decision
The `BudgetExhausted` message is inserted into the `outbox` table in the same transaction as the budget change.
A scheduled poller selects pending rows with `FOR UPDATE SKIP LOCKED`, publishes synchronously (acks=all,
idempotent producer, key = campaignId), then marks them published.

## Consequences
- At-least-once publication; downstream consumers dedupe on `eventId`.
- Added latency bounded by the poll interval (500 ms default).
- Polling load on the DB; log-based CDC (e.g. Debezium) is the scale-up path.
