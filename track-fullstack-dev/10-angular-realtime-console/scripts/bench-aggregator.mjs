// Throughput of the pure rolling aggregator (the code that runs inside the Web Worker).
// Node >= 22.18 strips TypeScript types natively, so the real source file is imported.
import { RollingAggregator } from '../src/app/core/aggregator.ts';

const campaigns = Array.from({ length: 8 }, (_, i) => `cmp-${i}`);
const batchSize = 2000;
const batches = 500; // 1,000,000 events
const mk = () => Array.from({ length: batchSize }, (_, i) => ({ campaignId: campaigns[i % 8], click: i % 25 === 0, costCents: 1 }));
const data = Array.from({ length: 50 }, mk);

const agg = new RollingAggregator();
let now = Date.now();
agg.ingest(data[0], now); // warm-up
const t0 = performance.now();
for (let b = 0; b < batches; b++) {
  agg.ingest(data[b % data.length], now + b * 10); // simulated 10 ms spacing
}
const ingestMs = performance.now() - t0;

const t1 = performance.now();
const N = 2000;
for (let i = 0; i < N; i++) agg.snapshot(now + batches * 10);
const snapUs = ((performance.now() - t1) / N) * 1000;

const events = batches * batchSize;
console.log(JSON.stringify({
  node: process.version,
  events,
  ingestMs: Math.round(ingestMs),
  eventsPerSecond: Math.round(events / (ingestMs / 1000)),
  snapshotMicroseconds: Math.round(snapUs),
}, null, 2));
