import { buildFunnel, describeFunnel, formatMoney, formatPercent, nextStatus, toggleLabel } from './domain';

describe('campaign domain', () => {
  it('toggles only ACTIVE and PAUSED', () => {
    expect(nextStatus('ACTIVE')).toBe('PAUSED');
    expect(nextStatus('PAUSED')).toBe('ACTIVE');
    expect(nextStatus('DRAFT')).toBeNull();
    expect(nextStatus('EXHAUSTED')).toBeNull();
    expect(toggleLabel('ACTIVE')).toBe('Pause');
    expect(toggleLabel('PAUSED')).toBe('Resume');
  });

  it('formats money and percentages', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatPercent(0.0345)).toBe('3.45%');
  });

  it('builds a funnel where tiny click counts stay visible', () => {
    const bars = buildFunnel({ impressions: 1_000_000, clicks: 10 });
    expect(bars[0]!.ratio).toBe(1);
    expect(bars[1]!.ratio).toBe(0.02);
    expect(describeFunnel(bars)).toBe('Impressions: 1,000,000, Clicks: 10');
  });

  it('handles an empty report', () => {
    expect(buildFunnel({ impressions: 0, clicks: 0 }).map((b) => b.ratio)).toEqual([0, 0]);
  });
});
