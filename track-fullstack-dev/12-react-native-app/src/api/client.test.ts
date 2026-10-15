import { ApiError, createApiClient } from './client';
import { createFakeServer, FAKE_TOKEN } from './fakeServer';

function setup(token: string | null = FAKE_TOKEN, onUnauthorized = jest.fn()) {
  const server = createFakeServer({ latencyMs: 0, count: 45 });
  const fetchSpy = jest.fn(server.fetch);
  const client = createApiClient({
    baseUrl: 'http://fake.local',
    fetchImpl: fetchSpy,
    getToken: async () => token,
    onUnauthorized,
  });
  return { server, client, fetchSpy, onUnauthorized };
}

describe('api client', () => {
  it('sends the bearer token and pagination params', async () => {
    const { client, fetchSpy } = setup();
    const page = await client.listCampaigns({ page: 2, pageSize: 10 });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://fake.local/v1/campaigns?page=2&pageSize=10');
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 45 });
    expect(page.items).toHaveLength(10);
    expect(page.items[0]!.id).toBe('cmp-011');
  });

  it('filters by status', async () => {
    const { client } = setup();
    const page = await client.listCampaigns({ status: 'PAUSED', pageSize: 100 });
    expect(page.items.every((c) => c.status === 'PAUSED')).toBe(true);
  });

  it('patches a campaign and returns the updated resource', async () => {
    const { client, server } = setup();
    const updated = await client.updateCampaign('cmp-001', { status: 'PAUSED' });
    expect(updated.status).toBe('PAUSED');
    expect(server.campaigns[0]!.status).toBe('PAUSED');
  });

  it('loads a report matching the contract shape', async () => {
    const { client } = setup();
    const report = await client.getCampaignReport('cmp-002');
    expect(Object.keys(report).sort()).toEqual(['campaignId', 'clicks', 'ctr', 'impressions', 'spendCents']);
    expect(report.ctr).toBeCloseTo(report.clicks / report.impressions);
  });

  it('maps problem+json responses to ApiError', async () => {
    const { client } = setup();
    await expect(client.getCampaign('nope')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      problem: { title: 'Campaign not found' },
    });
  });

  it('notifies on 401 and throws ApiError', async () => {
    const { client, onUnauthorized } = setup('bad-token');
    await expect(client.listCampaigns()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
