# ADR 001: Strangler fig with a routing proxy instead of a big-bang rewrite

Status: Accepted

## Context
The AdFlow monolith serves campaigns and reports from one shared schema. It has weak test coverage, undocumented behaviour (for example `CAMP_NM` truncation, report reads that mutate an audit counter) and a business that cannot freeze releases for a rewrite.

## Decision
Extract capabilities one at a time behind a **routing proxy**. Routes are data (path prefix -> percent to the new service), changeable at runtime. Unmatched paths default to the legacy. Reads are shadowed to the other side for parallel run; failures of the new service fall back to legacy.

## Consequences
- Positive: each step is small and reversible (rollback is a config change); real traffic validates the new service before cutover; legacy keeps delivering value meanwhile.
- Negative: the proxy is a new critical component and a temporary hop of latency; two systems coexist (and need dual-write and reconciliation); discipline is required to actually finish and delete legacy code.
- Alternative rejected: rewrite and switch over on a date. High risk, no early feedback, and requirements drift while the rewrite runs.
