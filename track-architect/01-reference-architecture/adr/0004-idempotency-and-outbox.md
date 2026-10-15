# ADR 0004: At-least-once delivery with idempotent consumers and transactional outbox

- Status: Accepted

## Context
Kafka delivers at least once. A retry must never charge a campaign twice, and a state change must never be committed without its event being published.

## Decision
Consumers record processed `eventId`s in the same transaction as the budget update. Outgoing events are written to an outbox table in that transaction and published by a poller.

## Alternatives considered
- Kafka exactly-once transactions: do not cover the database write, ties us to Kafka.
- Dual write (DB then publish): can lose or duplicate events on failure.

## Consequences
+ Correct under retries and crashes with plain infrastructure.
- Extra table and poller; dedupe table needs retention/cleanup.
