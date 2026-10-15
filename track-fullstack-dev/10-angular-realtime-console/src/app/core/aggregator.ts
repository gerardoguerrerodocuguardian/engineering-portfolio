import type { AggregateSnapshot, CampaignStat, CompactEvent } from './models';

interface Counts {
  impressions: number;
  clicks: number;
  spendCents: number;
}
interface Bucket {
  total: number;
  byCampaign: Map<string, Counts>;
}

/**
 * Rolling aggregates over per-second buckets. No I/O and no clock of its own (callers pass `nowMs`),
 * so it runs unchanged in a Web Worker, on the main thread (tests, no-Worker fallback) and in Node benchmarks.
 * Memory is bounded: buckets older than the window are dropped on every ingest/snapshot.
 */
export class RollingAggregator {
  private readonly buckets = new Map<number, Bucket>();
  private totalEvents = 0;

  // Plain fields (no parameter properties) so Node can type-strip and run this file in benchmarks.
  private readonly windowSec: number;
  private readonly rateWindowSec: number;

  constructor(windowSec = 30, rateWindowSec = 5) {
    this.windowSec = windowSec;
    this.rateWindowSec = rateWindowSec;
  }

  ingest(events: readonly CompactEvent[], nowMs: number): void {
    if (events.length === 0) return;
    const sec = Math.floor(nowMs / 1000);
    let bucket = this.buckets.get(sec);
    if (!bucket) {
      bucket = { total: 0, byCampaign: new Map() };
      this.buckets.set(sec, bucket);
      this.prune(sec);
    }
    for (const e of events) {
      let c = bucket.byCampaign.get(e.campaignId);
      if (!c) {
        c = { impressions: 0, clicks: 0, spendCents: 0 };
        bucket.byCampaign.set(e.campaignId, c);
      }
      if (e.click) c.clicks++;
      else c.impressions++;
      c.spendCents += e.costCents;
    }
    bucket.total += events.length;
    this.totalEvents += events.length;
  }

  snapshot(nowMs: number): AggregateSnapshot {
    const nowSec = Math.floor(nowMs / 1000);
    this.prune(nowSec);

    const merged = new Map<string, Counts>();
    const history: number[] = [];
    let rateTotal = 0;
    for (let s = nowSec - this.windowSec + 1; s <= nowSec; s++) {
      const b = this.buckets.get(s);
      history.push(b?.total ?? 0);
      if (!b) continue;
      if (s > nowSec - this.rateWindowSec) rateTotal += b.total;
      for (const [id, c] of b.byCampaign) {
        const m = merged.get(id) ?? { impressions: 0, clicks: 0, spendCents: 0 };
        m.impressions += c.impressions;
        m.clicks += c.clicks;
        m.spendCents += c.spendCents;
        merged.set(id, m);
      }
    }

    const campaigns: CampaignStat[] = [...merged].map(([campaignId, c]) => ({
      campaignId,
      ...c,
      ctr: c.impressions === 0 ? 0 : c.clicks / c.impressions,
    }));
    campaigns.sort((a, b) => b.impressions - a.impressions || a.campaignId.localeCompare(b.campaignId));

    return {
      eventsPerSec: Math.round((rateTotal / this.rateWindowSec) * 10) / 10,
      totalEvents: this.totalEvents,
      windowSec: this.windowSec,
      campaigns,
      history,
    };
  }

  private prune(nowSec: number): void {
    const oldest = nowSec - this.windowSec + 1;
    for (const key of this.buckets.keys()) if (key < oldest) this.buckets.delete(key);
  }
}
