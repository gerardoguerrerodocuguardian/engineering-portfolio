import type { components } from './api.generated';

export type Campaign = components['schemas']['Campaign'];

export interface CampaignResult {
  source: 'api' | 'synthetic';
  campaigns: Campaign[];
}

/** Used when no API is configured/reachable so the page always renders (demo resilience). */
export const syntheticCampaigns: Campaign[] = [
  { id: 'c-100', name: 'Spring audio push', status: 'ACTIVE', dailyBudgetCents: 5000, maxBidCents: 45, keywords: ['headphones'], createdAt: '2026-03-01T09:00:00Z' },
  { id: 'c-101', name: 'Standing desk bundle', status: 'PAUSED', dailyBudgetCents: 2500, maxBidCents: 30, keywords: ['desk'], createdAt: '2026-03-12T09:00:00Z' },
  { id: 'c-102', name: 'Weekend trail gear', status: 'DRAFT', dailyBudgetCents: 8000, maxBidCents: 60, keywords: ['backpack', 'hiking'], createdAt: '2026-04-02T09:00:00Z' },
];

/**
 * Lists campaigns from the shared contract (`GET /v1/campaigns`).
 * Configure with CAMPAIGN_API_URL and CAMPAIGN_API_TOKEN (server-only env vars).
 */
export async function fetchCampaigns(
  fetcher: typeof fetch = fetch,
  env: { url?: string; token?: string } = { url: process.env.CAMPAIGN_API_URL, token: process.env.CAMPAIGN_API_TOKEN },
): Promise<CampaignResult> {
  if (!env.url) return { source: 'synthetic', campaigns: syntheticCampaigns };
  try {
    const res = await fetcher(`${env.url}/v1/campaigns?pageSize=20`, {
      headers: env.token ? { Authorization: `Bearer ${env.token}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { items: Campaign[] };
    return { source: 'api', campaigns: body.items };
  } catch {
    return { source: 'synthetic', campaigns: syntheticCampaigns };
  }
}
