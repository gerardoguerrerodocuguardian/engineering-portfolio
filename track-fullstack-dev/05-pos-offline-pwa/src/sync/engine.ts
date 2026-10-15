import type { Db, OutboxEntry } from '../db/db';
import { getDeviceId } from '../db/repo';
import type { Command, CommandResult } from '../shared/protocol';
import type { Transport } from './types';

export interface EngineOptions {
  db: Db;
  transport: Transport;
  now?: () => number;
  random?: () => number;
  batchSize?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface FlushReport {
  /** false when the transport failed (offline/5xx): nothing was lost, backoff was scheduled. */
  reachable: boolean;
  applied: number;
  duplicates: number;
  rejected: number;
  retried: number;
  /** Pending entries left in the queue (excluding parked/failed ones). */
  remaining: number;
  error?: string;
}

export function backoffDelay(attempts: number, base: number, max: number, random: () => number): number {
  const exp = Math.min(max, base * 2 ** Math.max(0, attempts - 1));
  return Math.round(exp * (0.5 + random() / 2)); // 50-100% "equal jitter"
}

export function createSyncEngine(opts: EngineOptions) {
  const { db, transport } = opts;
  const now = opts.now ?? Date.now;
  const random = opts.random ?? Math.random;
  const batchSize = opts.batchSize ?? 25;
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 30_000;
  let inflight: Promise<FlushReport> | null = null;

  async function pendingInOrder(force: boolean): Promise<OutboxEntry[]> {
    const all = (await db.getAll('outbox')).filter((e) => e.status === 'pending').sort((a, b) => a.seq - b.seq);
    // Head-of-line: stop at the first entry still backing off, so later commands never overtake earlier ones.
    const ready: OutboxEntry[] = [];
    for (const e of all) {
      if (!force && e.nextAttemptAt > now()) break;
      ready.push(e);
    }
    return ready;
  }

  async function markTransient(entries: OutboxEntry[], error: string): Promise<void> {
    const tx = db.transaction('outbox', 'readwrite');
    for (const e of entries) {
      const attempts = e.attempts + 1;
      await tx.store.put({ ...e, attempts, lastError: error, nextAttemptAt: now() + backoffDelay(attempts, base, max, random) });
    }
    await tx.done;
  }

  async function settle(entry: OutboxEntry, r: CommandResult): Promise<'applied' | 'duplicate' | 'rejected' | 'retry'> {
    if (r.status === 'retry') {
      await markTransient([entry], r.error ?? 'server asked to retry');
      return 'retry';
    }
    const tx = db.transaction(['outbox', 'sales'], 'readwrite');
    const sale = await tx.objectStore('sales').get(entry.command.payload.saleId);
    if (r.status === 'rejected') {
      // Never delete: a rejected sale is parked for human review (it was already paid for at the till).
      await tx.objectStore('outbox').put({ ...entry, status: 'failed', lastError: r.error ?? 'rejected' });
      if (sale && entry.command.type === 'CreateSale') {
        await tx.objectStore('sales').put({ ...sale, syncState: 'failed', error: r.error ?? 'rejected' });
      }
    } else {
      await tx.objectStore('outbox').delete(entry.seq);
      if (sale && entry.command.type === 'CreateSale') {
        await tx.objectStore('sales').put({ ...sale, syncState: r.flags.length > 0 ? 'flagged' : 'synced', flags: r.flags });
      }
    }
    await tx.done;
    return r.status;
  }

  async function run(force: boolean): Promise<FlushReport> {
    const report: FlushReport = { reachable: true, applied: 0, duplicates: 0, rejected: 0, retried: 0, remaining: 0 };
    const deviceId = await getDeviceId(db);
    outer: for (;;) {
      const ready = (await pendingInOrder(force)).slice(0, batchSize);
      if (ready.length === 0) break;
      let response;
      try {
        response = await transport.sync(deviceId, ready.map((e) => e.command as Command));
      } catch (err) {
        await markTransient(ready, err instanceof Error ? err.message : String(err));
        report.reachable = false;
        report.error = err instanceof Error ? err.message : String(err);
        break;
      }
      const byId = new Map(response.results.map((r) => [r.id, r]));
      for (const entry of ready) {
        const r = byId.get(entry.command.id) ?? { id: entry.command.id, status: 'retry' as const, flags: [], error: 'no result returned' };
        const s = await settle(entry, r);
        if (s === 'applied') report.applied += 1;
        else if (s === 'duplicate') report.duplicates += 1;
        else if (s === 'rejected') report.rejected += 1;
        else report.retried += 1;
      }
      // After a transient failure stop; backoff decides when we come back (ordering preserved).
      if (report.retried > 0) break outer;
      force = false;
    }
    report.remaining = (await db.getAll('outbox')).filter((e) => e.status === 'pending').length;
    return report;
  }

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Tab and service worker share one outbox: serialise across contexts where Web Locks exist.
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    return locks ? ((await locks.request('adflow-outbox-flush', fn)) as T) : fn();
  }

  return {
    /** Concurrent callers share one in-flight flush. `force` ignores backoff (manual retry). */
    flush(flushOpts: { force?: boolean } = {}): Promise<FlushReport> {
      inflight ??= withLock(() => run(flushOpts.force ?? false)).finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
