/// <reference lib="webworker" />
import { RollingAggregator } from './aggregator';
import type { CompactEvent } from './models';

export type WorkerIn = { kind: 'ingest'; events: CompactEvent[] } | { kind: 'reset' };

let agg = new RollingAggregator();

addEventListener('message', ({ data }: MessageEvent<WorkerIn>) => {
  if (data.kind === 'reset') {
    agg = new RollingAggregator();
  } else {
    agg.ingest(data.events, Date.now());
  }
});

// Snapshots are pushed at a fixed cadence, never per message: the main thread sees a bounded update rate
// no matter how fast events arrive. The extra idle ticks let the window decay to zero after the stream stops.
setInterval(() => {
  postMessage({ kind: 'snapshot', snapshot: agg.snapshot(Date.now()) });
}, 500);
