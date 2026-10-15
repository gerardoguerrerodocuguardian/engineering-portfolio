import { RollingAggregator } from './aggregator';
import { CompactEvent } from './models';

const imp = (campaignId: string, costCents = 1): CompactEvent => ({ campaignId, click: false, costCents });
const clk = (campaignId: string, costCents = 30): CompactEvent => ({ campaignId, click: true, costCents });
const T0 = 1_000_000_000_000;

describe('RollingAggregator (pure)', () => {
  it('computes CTR and spend per campaign', () => {
    const a = new RollingAggregator();
    a.ingest([...Array(9).fill(imp('a')), clk('a'), imp('b'), imp('b')], T0);
    const s = a.snapshot(T0);
    const byId = Object.fromEntries(s.campaigns.map((c) => [c.campaignId, c]));
    expect(byId['a']).toMatchObject({ impressions: 9, clicks: 1, spendCents: 39 });
    expect(byId['a'].ctr).toBeCloseTo(1 / 9);
    expect(byId['b'].ctr).toBe(0);
    expect(s.totalEvents).toBe(12);
  });

  it('sorts by impressions desc and reports ctr 0 when there are no impressions', () => {
    const a = new RollingAggregator();
    a.ingest([imp('x'), imp('y'), imp('y'), clk('z')], T0);
    const s = a.snapshot(T0);
    expect(s.campaigns.map((c) => c.campaignId)).toEqual(['y', 'x', 'z']);
    expect(s.campaigns[2].ctr).toBe(0);
  });

  it('computes events/sec over the 5 s rate window', () => {
    const a = new RollingAggregator(30, 5);
    for (let s = 0; s < 5; s++) a.ingest(Array(100).fill(imp('a')), T0 + s * 1000);
    expect(a.snapshot(T0 + 4000).eventsPerSec).toBe(100);
    // two quiet seconds later only 3 busy seconds are inside the 5 s window
    expect(a.snapshot(T0 + 6000).eventsPerSec).toBe(60);
  });

  it('expires data outside the window and keeps memory bounded', () => {
    const a = new RollingAggregator(30, 5);
    a.ingest([imp('old')], T0);
    a.ingest([imp('new')], T0 + 31_000);
    const s = a.snapshot(T0 + 31_000);
    expect(s.campaigns.map((c) => c.campaignId)).toEqual(['new']);
    expect(s.totalEvents).toBe(2); // lifetime counter is not windowed
    expect((a as unknown as { buckets: Map<number, unknown> }).buckets.size).toBe(1);
  });

  it('returns a per-second history of the window length, oldest first', () => {
    const a = new RollingAggregator(5, 2);
    a.ingest([imp('a'), imp('a')], T0);
    a.ingest([imp('a')], T0 + 2000);
    expect(a.snapshot(T0 + 2000).history).toEqual([0, 0, 2, 0, 1]);
  });

  it('is empty-safe', () => {
    const s = new RollingAggregator().snapshot(T0);
    expect(s).toMatchObject({ eventsPerSec: 0, totalEvents: 0, campaigns: [] });
  });
});
