# ADR 0001: Event-driven ingestion for impressions and clicks

- Status: Accepted

## Context
Impressions and clicks arrive in bursts, far above campaign-management traffic. Synchronous writes to the budget store would couple ad serving to database latency.

## Decision
Ingest impressions and clicks as events on Kafka, partitioned by `campaignId`, and process them asynchronously in the bidding platform.

## Alternatives considered
- Synchronous REST per event: simple, but backpressure hits the serving path.
- Batch files: cheap, but budgets would lag by minutes or hours.

## Consequences
+ Absorbs spikes and decouples producers from consumers; ordering per campaign.
- Eventual consistency: budget can overshoot slightly. Mitigated with a small safety margin.
- Requires idempotency (see ADR 0004).
