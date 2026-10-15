import type { FetchLike } from './client';
import type { Campaign, CampaignReport, CampaignStatus, Problem, UpdateCampaign } from './types';
import { CAMPAIGN_STATUSES } from './types';

export const FAKE_TOKEN = 'fake-token-not-a-secret';

export interface FakeServerOptions {
  /** Number of synthetic campaigns. */
  count?: number;
  /** Artificial latency in ms (0 in tests). */
  latencyMs?: number;
  /** Return a 500 for the next N PATCH requests (to exercise rollback). */
  failNextPatches?: number;
}

export interface FakeServer {
  fetch: FetchLike;
  campaigns: Campaign[];
  options: FakeServerOptions;
}

const WORDS = ['Spring', 'Summer', 'Autumn', 'Winter', 'Launch', 'Retarget', 'Brand', 'Local', 'Mobile', 'Video'];

export function seedCampaigns(count: number): Campaign[] {
  return Array.from({ length: count }, (_, i) => {
    const status: CampaignStatus = CAMPAIGN_STATUSES[i % CAMPAIGN_STATUSES.length]!;
    return {
      id: `cmp-${String(i + 1).padStart(3, '0')}`,
      name: `${WORDS[i % WORDS.length]} push ${i + 1}`,
      status,
      dailyBudgetCents: 5_000 + (i % 7) * 2_500,
      maxBidCents: 40 + (i % 5) * 15,
      keywords: ['sneakers', 'running', `kw-${i + 1}`],
      createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    };
  });
}

export function reportFor(campaign: Campaign): CampaignReport {
  const n = Number(campaign.id.replace(/\D/g, '')) || 1;
  const impressions = 10_000 + n * 1_317;
  const clicks = Math.round(impressions * (0.01 + (n % 5) * 0.004));
  return {
    campaignId: campaign.id,
    impressions,
    clicks,
    spendCents: clicks * campaign.maxBidCents,
    ctr: clicks / impressions,
  };
}

function json(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

function problem(status: number, title: string): Response {
  const body: Problem = { type: 'about:blank', title, status };
  return json(body, status, 'application/problem+json');
}

/** In-memory implementation of the campaign contract, used by dev builds and tests. */
export function createFakeServer(options: FakeServerOptions = {}): FakeServer {
  const state: FakeServer = {
    campaigns: seedCampaigns(options.count ?? 45),
    options: { latencyMs: 250, failNextPatches: 0, ...options },
    fetch: async () => problem(500, 'not initialised'),
  };

  state.fetch = async (input, init) => {
    if (state.options.latencyMs) await new Promise((r) => setTimeout(r, state.options.latencyMs));

    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (headers.Authorization !== `Bearer ${FAKE_TOKEN}`) return problem(401, 'Unauthorized');

    const url = new URL(input, 'http://fake.local');
    const method = init?.method ?? 'GET';
    const path = url.pathname;

    if (method === 'GET' && path === '/v1/campaigns') {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));
      const status = url.searchParams.get('status');
      const all = status ? state.campaigns.filter((c) => c.status === status) : state.campaigns;
      return json({ items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: all.length });
    }

    const match = /^\/v1\/campaigns\/([^/]+)(\/report)?$/.exec(path);
    if (match) {
      const campaign = state.campaigns.find((c) => c.id === decodeURIComponent(match[1]!));
      if (!campaign) return problem(404, 'Campaign not found');
      if (match[2] && method === 'GET') return json(reportFor(campaign));
      if (!match[2] && method === 'GET') return json(campaign);
      if (!match[2] && method === 'PATCH') {
        if ((state.options.failNextPatches ?? 0) > 0) {
          state.options.failNextPatches = (state.options.failNextPatches ?? 0) - 1;
          return problem(500, 'Simulated server failure');
        }
        const patch = JSON.parse(String(init?.body ?? '{}')) as UpdateCampaign;
        Object.assign(campaign, patch);
        return json(campaign);
      }
    }
    return problem(404, 'Not found');
  };

  return state;
}
