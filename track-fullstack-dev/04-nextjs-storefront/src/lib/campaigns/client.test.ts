import { describe, expect, it, vi } from 'vitest';
import { fetchCampaigns, syntheticCampaigns } from './client';

describe('fetchCampaigns', () => {
  it('falls back to synthetic data without a URL', async () => {
    const r = await fetchCampaigns(vi.fn(), {});
    expect(r).toEqual({ source: 'synthetic', campaigns: syntheticCampaigns });
  });

  it('returns API items and sends the bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [syntheticCampaigns[0]], page: 1, pageSize: 20, total: 1 })));
    const r = await fetchCampaigns(fetcher as unknown as typeof fetch, { url: 'http://api.test', token: 't' });
    expect(r.source).toBe('api');
    expect(fetcher).toHaveBeenCalledWith('http://api.test/v1/campaigns?pageSize=20', expect.objectContaining({ headers: { Authorization: 'Bearer t' } }));
  });

  it('falls back when the API fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('x', { status: 500 }));
    expect((await fetchCampaigns(fetcher as unknown as typeof fetch, { url: 'http://api.test' })).source).toBe('synthetic');
  });
});
