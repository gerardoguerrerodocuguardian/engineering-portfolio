import { AggregatorPort } from './aggregator-port';
import type { WorkerIn } from './aggregate.worker';
import { AggregateSnapshot, CompactEvent } from './models';

/** Kept in its own file because `import.meta.url` cannot be compiled by Jest (CommonJS). */
export class WorkerAggregator implements AggregatorPort {
  private readonly worker = new Worker(new URL('./aggregate.worker', import.meta.url), { type: 'module' });

  ingest(events: CompactEvent[]): void {
    this.post({ kind: 'ingest', events });
  }
  reset(): void {
    this.post({ kind: 'reset' });
  }
  onSnapshot(cb: (s: AggregateSnapshot) => void): void {
    this.worker.onmessage = (e: MessageEvent<{ kind: 'snapshot'; snapshot: AggregateSnapshot }>) => cb(e.data.snapshot);
  }
  dispose(): void {
    this.worker.terminate();
  }
  private post(msg: WorkerIn): void {
    this.worker.postMessage(msg);
  }
}
