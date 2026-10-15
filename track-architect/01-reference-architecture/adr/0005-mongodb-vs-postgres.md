# ADR 0005: MongoDB for campaigns, PostgreSQL for money

- Status: Accepted

## Context
Campaign documents are nested and evolve (keywords, targeting). Budget accounting needs transactions and constraints.

## Decision
Store campaign definitions in MongoDB and budget ledgers/idempotency/outbox in PostgreSQL.

## Alternatives considered
- Single PostgreSQL with JSONB: viable and simpler to operate; chosen against here to demonstrate the polyglot trade-off honestly.

## Consequences
+ Each store fits its workload.
- Two datastores to operate; no cross-store transactions, so integration is by events.
