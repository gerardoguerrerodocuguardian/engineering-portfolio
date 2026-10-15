# ADR 0006: LLM agent — read-only tools, budgets and evals

- Status: Accepted

## Context
An agent that calls tools can leak data, loop, or run up cost. Tool results can contain prompt-injection text.

## Decision
Expose read-only, allow-listed tools with schema-validated arguments; cap iterations and tokens; treat tool output as untrusted; gate changes with an eval suite.

## Alternatives considered
- Write-capable tools with human approval: valuable later, out of scope for the first version.

## Consequences
+ Bounded blast radius and cost; regressions caught by evals.
- Less capable than a fully autonomous agent, by design.
