import { http, HttpResponse, type HttpHandler } from 'msw';
import type { components, paths } from '@/api/schema';
import { campaigns, nextId } from './db';
import * as db from './db';

/**
 * Handlers are typed from the generated contract types, so a contract change
 * breaks compilation here. `handledOperations` is compared with the YAML
 * contract in contract.test.ts, so a new endpoint without a mock fails CI.
 */
type Campaign = components['schemas']['Campaign'];
type Page = paths['/v1/campaigns']['get']['responses']['200']['content']['application/json'];
type Report = components['schemas']['CampaignReport'];
type Problem = components['schemas']['Problem'];

export const handledOperations = [
  'get /v1/campaigns',
  'post /v1/campaigns',
  'get /v1/campaigns/{id}',
  'patch /v1/campaigns/{id}',
  'delete /v1/campaigns/{id}',
  'get /v1/campaigns/{id}/report',
] as const;

const problem = (status: number, title: string) =>
  HttpResponse.json<Problem>({ type: 'about:blank', title, status }, { status, headers: { 'Content-Type': 'application/problem+json' } });

/** Mock identity service. Tokens are opaque strings; "access-N" is valid until expireAccessTokens() bumps N. */
let generation = 1;
export const expireAccessTokens = () => void generation++;
export const resetAuth = () => (generation = 1);
const accessToken = () => `access-${generation}`;
const user = { name: 'Ada Example', role: 'ADMIN' as const };

const authorized = (req: Request) => req.headers.get('Authorization') === `Bearer ${accessToken()}`;

const REAL_DELAY = import.meta.env.MODE === 'test' ? 0 : 250;
const delay = () => (REAL_DELAY ? new Promise((r) => setTimeout(r, REAL_DELAY)) : undefined);

export const handlers: HttpHandler[] = [
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email !== 'ada@adflow.test' || body.password !== 'adflow-demo') return problem(401, 'Invalid credentials');
    return HttpResponse.json({ accessToken: accessToken(), refreshToken: 'refresh-1', user });
  }),
  http.post('*/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken: string };
    if (body.refreshToken !== 'refresh-1') return problem(401, 'Invalid refresh token');
    return HttpResponse.json({ accessToken: accessToken(), refreshToken: 'refresh-1', user });
  }),

  http.get('*/v1/campaigns', async ({ request }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    await delay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
    const status = url.searchParams.get('status');
    const filtered = status ? campaigns.filter((c) => c.status === status) : campaigns;
    const body: Page = { items: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: filtered.length };
    return HttpResponse.json(body);
  }),
  http.post('*/v1/campaigns', async ({ request }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    const input = (await request.json()) as components['schemas']['CreateCampaign'];
    if (!input.name || input.name.length < 3) return problem(400, 'Invalid name');
    const created: Campaign = { id: nextId(), status: 'DRAFT', createdAt: new Date().toISOString(), keywords: [], ...input };
    campaigns.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get('*/v1/campaigns/:id', ({ request, params }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    const found = campaigns.find((c) => c.id === params.id);
    return found ? HttpResponse.json(found) : problem(404, 'Campaign not found');
  }),
  http.patch('*/v1/campaigns/:id', async ({ request, params }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    await delay();
    const idx = campaigns.findIndex((c) => c.id === params.id);
    if (idx < 0) return problem(404, 'Campaign not found');
    const patch = (await request.json()) as components['schemas']['UpdateCampaign'];
    const updated = { ...campaigns[idx]!, ...patch };
    campaigns[idx] = updated;
    return HttpResponse.json(updated);
  }),
  http.delete('*/v1/campaigns/:id', ({ request, params }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    db.campaigns.splice(0, db.campaigns.length, ...db.campaigns.filter((c) => c.id !== params.id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/v1/campaigns/:id/report', async ({ request, params }) => {
    if (!authorized(request)) return problem(401, 'Unauthorized');
    await delay();
    const found = campaigns.find((c) => c.id === params.id);
    if (!found) return problem(404, 'Campaign not found');
    const impressions = 10_000 + found.dailyBudgetCents;
    const clicks = Math.round(impressions * 0.032);
    const body: Report = { campaignId: found.id, impressions, clicks, spendCents: clicks * found.maxBidCents, ctr: clicks / impressions };
    return HttpResponse.json(body);
  }),
];
