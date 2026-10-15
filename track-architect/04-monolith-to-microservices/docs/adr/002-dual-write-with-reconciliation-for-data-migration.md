# ADR 002: Backfill plus dual-write plus reconciliation for campaign data

Status: Accepted (demo uses proxy-level dual-write; production should use an outbox or CDC)

## Context
The new service needs its own store, and both systems must agree during the coexistence window. Legacy is the system of record until cutover.

## Decision
1. **Backfill** legacy -> new through the ACL (idempotent upsert, safe to re-run).
2. **Dual-write** creates: the primary is chosen by routing, then exactly what the primary stored is replicated to the other side. A failed secondary write is counted and not propagated to the client.
3. **Reconcile** continuously: compare both stores field by field using the shared diff; `repair` copies legacy over drift and missing rows but never deletes rows that exist only in the new store. Known, documented legacy limitations (name truncation) are tolerated explicitly in the diff.
4. After cutover, keep the reverse direction (new -> legacy) until the rollback window closes.

## Consequences
- Positive: simple, observable, no schema coupling between the systems; drift from unmanaged legacy writers (batch jobs) is detected, as the demo shows.
- Negative: dual-write is not atomic, so there are short inconsistency windows and ordering risks; production-grade options are a transactional outbox or log-based change data capture, which remove writes from the request path.
- Operational: reconciliation mismatch count is a cutover gate (target: zero unexplained mismatches over an agreed period).
