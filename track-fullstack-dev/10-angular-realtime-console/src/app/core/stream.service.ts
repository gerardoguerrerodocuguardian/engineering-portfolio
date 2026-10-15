import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Subscription, bufferTime, filter, map } from 'rxjs';
import { AGGREGATOR_FACTORY } from './aggregator-port';
import { EventLog, RecentIds } from './event-log';
import { AdEvent, AggregateSnapshot, EMPTY_SNAPSHOT, parseAdEvent, toCompact } from './models';
import { ConnectionStatus, reconnectingSource } from './reconnecting-source';
import { SERVER_BASE, TRANSPORT_FACTORY, TransportKind } from './transport';

export interface StreamOptions {
  /** Batch window: every flush is ONE signal update regardless of how many events arrived. */
  flushMs: number;
  /** Backpressure: at most this many rows per flush reach the log; the rest are sampled out (aggregates stay exact). */
  maxLogRowsPerFlush: number;
  logCapacity: number;
  backoff: { baseMs: number; capMs: number };
}

export const STREAM_OPTIONS = new InjectionToken<StreamOptions>('STREAM_OPTIONS', {
  providedIn: 'root',
  factory: () => ({ flushMs: 100, maxLogRowsPerFlush: 2_500, logCapacity: 100_000, backoff: { baseMs: 500, capMs: 15_000 } }),
});

/**
 * Owns the live connection and the data derived from it. RxJS is used for exactly one thing here:
 * socket messages -> parse -> bufferTime. Everything the UI reads is a signal.
 */
@Injectable({ providedIn: 'root' })
export class StreamService {
  private readonly openerFactory = inject(TRANSPORT_FACTORY);
  private readonly base = inject(SERVER_BASE);
  private readonly opts = inject(STREAM_OPTIONS);
  private readonly aggregator = inject(AGGREGATOR_FACTORY)();

  readonly log = new EventLog(this.opts.logCapacity);
  private readonly seen = new RecentIds();
  private sub?: Subscription;

  // --- state exposed as read-only signals ---------------------------------------------------------
  private readonly _connection = signal<ConnectionStatus>({ state: 'idle', attempt: 0 });
  private readonly _paused = signal(false);
  private readonly _received = signal(0);
  private readonly _duplicates = signal(0);
  private readonly _sampledOut = signal(0);
  private readonly _logSize = signal(0);
  private readonly _logVersion = signal(0);
  private readonly _snapshot = signal<AggregateSnapshot>(EMPTY_SNAPSHOT);
  private latest: AggregateSnapshot = EMPTY_SNAPSHOT;

  readonly connection = this._connection.asReadonly();
  readonly paused = this._paused.asReadonly();
  readonly received = this._received.asReadonly();
  readonly duplicates = this._duplicates.asReadonly();
  readonly sampledOut = this._sampledOut.asReadonly();
  readonly logSize = this._logSize.asReadonly();
  /** Bumped once per flush. The ring buffer is mutable, so this is the change signal derived views depend on. */
  readonly logVersion = this._logVersion.asReadonly();
  readonly snapshot = this._snapshot.asReadonly();

  constructor() {
    this.aggregator.onSnapshot((s) => {
      this.latest = s;
      if (!this._paused()) this._snapshot.set(s);
    });
    inject(DestroyRef).onDestroy(() => {
      this.disconnect();
      this.aggregator.dispose();
    });
  }

  connect(kind: TransportKind): void {
    this.disconnect();
    const opener = this.openerFactory(kind, this.base);
    this.sub = reconnectingSource(opener, this.opts.backoff, (s) => this._connection.set(s))
      .pipe(
        map(parseAdEvent),
        filter((e): e is AdEvent => e !== null),
        bufferTime(this.opts.flushMs),
        filter((batch) => batch.length > 0),
      )
      .subscribe((batch) => this.ingest(batch));
  }

  disconnect(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  setPaused(paused: boolean): void {
    this._paused.set(paused);
    if (!paused) {
      // Resume: catch the frozen views up in one step.
      this._snapshot.set(this.latest);
      this._logVersion.update((v) => v + 1);
    }
  }

  clear(): void {
    this.log.clear();
    this.seen.clear();
    this.aggregator.reset();
    this.latest = EMPTY_SNAPSHOT;
    this._snapshot.set(EMPTY_SNAPSHOT);
    this._received.set(0);
    this._duplicates.set(0);
    this._sampledOut.set(0);
    this._logSize.set(0);
    this._logVersion.update((v) => v + 1);
  }

  private ingest(batch: AdEvent[]): void {
    const fresh: AdEvent[] = [];
    for (const e of batch) if (this.seen.add(e.eventId)) fresh.push(e);
    const dups = batch.length - fresh.length;

    // Aggregates always see every unique event (cheap counters, off the main thread).
    this.aggregator.ingest(fresh.map(toCompact));

    // The log is the expensive view: sample evenly when a flush exceeds the cap.
    const stride = Math.max(1, Math.ceil(fresh.length / this.opts.maxLogRowsPerFlush));
    let kept = 0;
    for (let i = 0; i < fresh.length; i += stride) {
      this.log.push(fresh[i]);
      kept++;
    }

    this._received.update((n) => n + batch.length);
    if (dups) this._duplicates.update((n) => n + dups);
    if (fresh.length > kept) this._sampledOut.update((n) => n + fresh.length - kept);
    this._logSize.set(this.log.size);
    if (!this._paused()) this._logVersion.update((v) => v + 1);
  }
}
