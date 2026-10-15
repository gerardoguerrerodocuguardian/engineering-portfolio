# ADR 0007: Start modular; split on evidence

- Status: Accepted

## Context
Microservices add operational cost. Many teams split too early.

## Decision
Keep clear module boundaries (hexagonal, enforced by ArchUnit). Extract a service only when scaling, team ownership or release cadence demands it.

## Alternatives considered
- Microservices from day one: maximum independence, maximum overhead.

## Consequences
+ Lower cost now, cheap split later because boundaries are already enforced.
- Requires discipline so the modular code does not erode.
