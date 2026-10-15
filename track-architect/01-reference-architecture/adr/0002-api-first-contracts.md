# ADR 0002: API-first with OpenAPI and AsyncAPI

- Status: Accepted

## Context
A Java service, a NestJS API, an Angular app and an AI agent must agree on shapes without constant meetings.

## Decision
Contracts are written first and stored in `shared/contracts`. Providers conform to them and tests assert it.

## Alternatives considered
- Code-first only: faster to start, but contracts drift and consumers discover breaking changes late.

## Consequences
+ Parallel work, typed clients, automated conformance checks.
- Discipline needed to version and review contract changes.
