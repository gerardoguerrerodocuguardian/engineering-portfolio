/**
 * Consumer-driven contract: what the (fictional) AdFlow dashboard needs from the Campaign API.
 * Only fields the dashboard actually reads are asserted, with type matchers rather than exact values,
 * so the provider stays free to add fields. Output: pacts/adflow-dashboard-adflow-campaign-api.json
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { ApiClient } from '../src/api-client';

const { like, eachLike, integer, number, regex, fromProviderState } = MatchersV3;
const ISO = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$';

const pact = new PactV4({
  consumer: 'adflow-dashboard',
  provider: 'adflow-campaign-api',
  dir: join(__dirname, '../pacts'),
  logLevel: 'warn',
});

const bearer = { Authorization: like('Bearer eyJhbGciOiJSUzI1NiJ9.synthetic.token') };

test('dashboard lists campaigns for the overview table', async () => {
  await pact
    .addInteraction()
    .given('at least one campaign exists')
    .uponReceiving('a request for the first page of campaigns')
    .withRequest('GET', '/v1/campaigns', (b) => b.query({ page: '1', pageSize: '20' }).headers(bearer))
    .willRespondWith(200, (b) =>
      b.headers({ 'Content-Type': 'application/json' }).jsonBody({
        items: eachLike({
          id: like('65f0000000000000000000aa'),
          name: like('Autumn Sale'),
          status: regex('^(DRAFT|ACTIVE|PAUSED|EXHAUSTED)$', 'ACTIVE'),
          dailyBudgetCents: integer(50000),
          maxBidCents: integer(120),
          createdAt: regex(ISO, '2026-01-01T10:00:00.000Z'),
        }),
        page: integer(1),
        pageSize: integer(20),
        total: integer(1),
      }),
    )
    .executeTest(async (mock) => {
      const res = await new ApiClient(mock.url).listCampaigns('eyJhbGciOiJSUzI1NiJ9.synthetic.token', {
        page: 1,
        pageSize: 20,
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.items.length >= 1);
      assert.equal(typeof res.body.items[0].dailyBudgetCents, 'number');
    });
});

test('dashboard shows the performance report of a campaign', async () => {
  await pact
    .addInteraction()
    .given('a campaign exists', { id: '65f0000000000000000000aa' })
    .uponReceiving('a request for a campaign report')
    .withRequest(
      'GET',
      fromProviderState('/v1/campaigns/${id}/report', '/v1/campaigns/65f0000000000000000000aa/report') as any,
      (b) => b.headers(bearer),
    )
    .willRespondWith(200, (b) =>
      b.headers({ 'Content-Type': 'application/json' }).jsonBody({
        campaignId: fromProviderState('${id}', '65f0000000000000000000aa'),
        impressions: integer(1000),
        clicks: integer(25),
        spendCents: integer(3000),
        ctr: number(0.025),
      }),
    )
    .executeTest(async (mock) => {
      const res = await new ApiClient(mock.url).getReport('eyJhbGciOiJSUzI1NiJ9.synthetic.token', '65f0000000000000000000aa');
      assert.equal(res.status, 200);
      assert.equal(typeof res.body.ctr, 'number');
    });
});

test('dashboard handles a missing campaign as a problem document', async () => {
  await pact
    .addInteraction()
    .given('no campaign with id 000000000000000000000000 exists')
    .uponReceiving('a request for an unknown campaign')
    .withRequest('GET', '/v1/campaigns/000000000000000000000000', (b) => b.headers(bearer))
    .willRespondWith(404, (b) =>
      b.headers({ 'Content-Type': 'application/problem+json' }).jsonBody({
        type: like('https://api.adflow.local/problems/not-found'),
        title: like('Not found'),
        status: integer(404),
      }),
    )
    .executeTest(async (mock) => {
      const res = await new ApiClient(mock.url).getCampaign('eyJhbGciOiJSUzI1NiJ9.synthetic.token', '000000000000000000000000');
      assert.equal(res.status, 404);
      assert.equal(res.body.status, 404);
    });
});
