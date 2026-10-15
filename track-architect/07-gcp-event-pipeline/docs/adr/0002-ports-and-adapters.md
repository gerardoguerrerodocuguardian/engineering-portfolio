# ADR 0002: Transport and store behind ports

Status: accepted

## Context
The pipeline must run on a laptop, in tests, and on Cloud Run, and the team may need to move between Pub/Sub and Kafka, or between BigQuery and another warehouse, without rewriting business logic.

## Decision
`EventSource` (Pub/Sub, Kafka stub, in-memory) and `AggregateSink` (BigQuery, DuckDB, in-memory) are ports in the application layer. ArchUnit enforces that domain and application know nothing about adapters or cloud SDKs. Selection is by property (`adflow.source`, `adflow.sink`).

## Consequences
- The same code runs everywhere, and one contract-test suite verifies every sink implementation.
- The common-denominator port hides transport features (ordering keys, ack deadlines, Kafka offsets); those stay in the adapter and are documented there.
