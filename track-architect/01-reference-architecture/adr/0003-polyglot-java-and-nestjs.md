# ADR 0003: Polyglot — Spring Boot for the core, NestJS for edge APIs

- Status: Accepted

## Context
The bidding core needs strong typing, mature Kafka/JPA tooling and predictable JVM performance. Edge CRUD APIs shared with TypeScript front ends benefit from one language and fast iteration.

## Decision
Use Spring Boot (Java 21) for bidding and budgets, NestJS (TypeScript) for the campaign API.

## Alternatives considered
- Everything in Java: fewer stacks to operate.
- Everything in Node: weaker fit for the transactional, high-throughput core.

## Consequences
+ Right tool per boundary, shared OpenAPI contract keeps them aligned.
- Two toolchains, two CI paths, wider skill needs on the team.
