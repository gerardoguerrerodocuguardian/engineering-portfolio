# ADR-001: Offline-first point of sale (local source of truth + outbox)

Status: accepted

## Context

A till must keep selling when the store network drops: Wi-Fi is flaky, uplinks fail, and a queue at the register is
the most expensive place to show a spinner. Payments are simulated here, but the same constraint applies to real tenders:
the customer has already walked away with the goods when the network comes back.

## Options

1. **Online-only** (every sale is a synchronous API call). Simplest model, one source of truth, no conflicts.
   But a network blip means no sales, or paper fallback and manual re-keying.
2. **Online-first with a cache** (cache catalog, fail sales when offline). Helps reads only; the write path is the
   business-critical one.
3. **Offline-first** (IndexedDB is the source of truth for the till; the server is a replica that converges). Sales
   always succeed locally; sync is background work.

## Decision

Option 3.

- The till writes a sale and an **outbox command** (idempotency key + local sequence number) in **one IndexedDB
  transaction**. A sale that exists without its command (or the reverse) is impossible.
- A sync engine drains the outbox in order, in batches, with exponential backoff + jitter. It is triggered by the `online`
  event, a timer, the Background Sync API (service worker, Chromium) and a manual "Retry sync" button.
- The server applies commands **idempotently per key** (and per `saleId`) and returns a per-command result, so a batch
  can partly succeed and a lost response is harmless (replay returns `duplicate`).
- The service worker precaches the app shell; data is never served from the SW cache, only from IndexedDB.

## Conflict policy

| Data | Policy | Why |
| --- | --- | --- |
| Sales | **Never lose a sale.** Structurally valid sales are always accepted. | Goods and money already changed hands. |
| Prices | **Server-authoritative** for the catalog the till sees. A sale quoted at a stale price is accepted at the quoted (charged) price and **flagged** `price_changed` with quoted vs current. | The customer paid what the screen said; finance reviews the delta. Rewriting the charge would break the receipt. |
| Unknown / discontinued SKU | Accepted and flagged (`unknown_sku`, `inactive_sku`). | Same reason. |
| Sale notes (non-critical) | **Last-writer-wins** by client timestamp. | Cheap, and losing an old note is harmless. |
| Structurally invalid command | `rejected`, parked on the device as "needs review", never silently deleted. | Retrying cannot help; a human must decide. |
| Transient server error | `retry`; the rest of the batch is deferred to keep order. | Preserves command ordering. |

## Consequences

- Cost: more client code (outbox, backoff, locks), eventual consistency of reports, and clock-dependent LWW.
- First launch needs a connection to fetch the catalog.
- Reporting must read `chargedCents` (what was paid) and may compare to `listCents` (current price) for flagged sales.
- Local data is a liability: in a real deployment IndexedDB would need encryption-at-rest policy, a device
  identity/registration step and an eviction/retention rule. Not implemented here.
