import type { Campaign, CampaignStatus } from '@/api/types';

/** Only running or paused campaigns can be toggled; drafts and exhausted ones cannot. */
export function nextStatus(status: CampaignStatus): CampaignStatus | null {
  if (status === 'ACTIVE') return 'PAUSED';
  if (status === 'PAUSED') return 'ACTIVE';
  return null;
}

export function toggleLabel(status: CampaignStatus): string | null {
  if (status === 'ACTIVE') return 'Pause';
  if (status === 'PAUSED') return 'Resume';
  return null;
}

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export interface ChartBar {
  key: 'impressions' | 'clicks';
  label: string;
  value: number;
  /** 0..1 share of the widest bar; clicks get a visible minimum so they never vanish. */
  ratio: number;
}

/** Funnel: impressions are the full bar, clicks are scaled by CTR. */
export function buildFunnel(report: { impressions: number; clicks: number }): ChartBar[] {
  const max = Math.max(report.impressions, 1);
  const clickRatio = report.clicks === 0 ? 0 : Math.max(report.clicks / max, 0.02);
  return [
    { key: 'impressions', label: 'Impressions', value: report.impressions, ratio: report.impressions === 0 ? 0 : 1 },
    { key: 'clicks', label: 'Clicks', value: report.clicks, ratio: clickRatio },
  ];
}

export function describeFunnel(bars: ChartBar[]): string {
  return bars.map((b) => `${b.label}: ${formatCount(b.value)}`).join(', ');
}

export function flattenPages(pages: { items: Campaign[] }[] | undefined): Campaign[] {
  return pages ? pages.flatMap((p) => p.items) : [];
}
