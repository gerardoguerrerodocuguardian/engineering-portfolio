# ADR 0002: PostgreSQL Flexible Server instead of Cosmos DB (MongoDB API)

Status: accepted

## Context
Campaign, budget and reporting data is relational (joins, constraints, transactions). The AWS counterpart uses RDS PostgreSQL, so the schema and queries stay portable. Cosmos DB for MongoDB was considered for flexible event documents.

## Decision
Use **PostgreSQL Flexible Server**: VNet-injected, no public endpoint, Entra-only auth (password auth disabled), zone-redundant HA and geo-redundant backups in prod.

## Consequences
- Portable across clouds; standard tooling; predictable cost (instance + storage).
- Entra-only means the app connects with an access token; connection pools must refresh tokens (~1 hour validity). A break-glass local admin is intentionally not created; recovery goes through the Entra admin group.
- Horizontal write scale is limited vs Cosmos. If per-learner or per-impression document workloads outgrow it, add Cosmos (Mongo or NoSQL API) for that data only; the module boundary makes that an additive change.
- Cosmos RU/s provisioning and partition-key design are a cost and design risk that this workload does not justify yet.
