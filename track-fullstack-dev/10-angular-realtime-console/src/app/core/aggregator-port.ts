import { InjectionToken } from '@angular/core';
import { RollingAggregator } from './aggregator';
import { AggregateSnapshot, CompactEvent } from './models';

/** The stream service only knows this port; the worker implementation is wired in app.config. */
export interface AggregatorPort {
  ingest(events: CompactEvent[]): void;
  reset(): void;
  onSnapshot(cb: (s: AggregateSnapshot) => void): void;
  dispose(): void;
}

/** Same algorithm on the main thread: used by unit tests and when `Worker` is unavailable. */
export class InlineAggregator implements AggregatorPort {
  private agg = new RollingAggregator();
  private cb: (s: AggregateSnapshot) => void = () => {};
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(intervalMs = 500) {
    this.timer = setInterval(() => this.cb(this.agg.snapshot(Date.now())), intervalMs);
  }
  ingest(events: CompactEvent[]): void {
    this.agg.ingest(events, Date.now());
  }
  reset(): void {
    this.agg = new RollingAggregator();
  }
  onSnapshot(cb: (s: AggregateSnapshot) => void): void {
    this.cb = cb;
  }
  dispose(): void {
    clearInterval(this.timer);
  }
}

export const AGGREGATOR_FACTORY = new InjectionToken<() => AggregatorPort>('AGGREGATOR_FACTORY', {
  providedIn: 'root',
  factory: () => () => new InlineAggregator(),
});
