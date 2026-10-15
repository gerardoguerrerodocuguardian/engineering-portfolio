# ADR 0003: Hexagonal architecture enforced by ArchUnit

Status: accepted

## Context
Business rules (budget accounting, auction) must be testable without Kafka, JPA or Spring, and
infrastructure must be replaceable (e.g. Kafka for Pub/Sub).

## Decision
Packages: `domain` (pure Java), `application` (use-case ports in/out and services), `adapters.in`
(Kafka listener, REST, scheduler), `adapters.out` (JPA, Kafka producer). Dependencies point inward.
`HexagonalArchitectureTest` fails the build on violations (framework in domain, application to adapters,
adapter to adapter).

## Consequences
- Fast pure unit tests; adapters are swappable.
- More types (ports, mapping between entities and domain objects) than a layered CRUD design.
- Application services keep `@Service`/`@Transactional` as a pragmatic concession.
