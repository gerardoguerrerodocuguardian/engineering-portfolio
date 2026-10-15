# ADR 0002: Transport and store behind ports

Status: accepted

`EventSource` (Pub/Sub, Kafka stub, in-memory) and `AggregateSink` (BigQuery, DuckDB, in-memory) are ports in
the application layer. ArchUnit enforces that domain/application know nothing about adapters or cloud SDKs.
Selection is by property (`adflow.source`, `adflow.sink`), so the same code runs on a laptop, in tests, and on
Cloud Run. Trade-off: the common-denominator port hides transport features (ordering keys, ack deadlines,
Kafka offsets); those stay in the adapter and are documented there.
