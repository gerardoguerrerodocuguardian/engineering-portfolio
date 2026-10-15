import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { AdflowWorld } from '../support/world';
import { config } from '../../src/config';

const campaignBody = (name: string, budget: number, bid: number) => ({
  name,
  dailyBudgetCents: budget,
  maxBidCents: bid,
  keywords: ['synthetic'],
});

// ---------- Given ----------
Given('I am signed in as an advertiser', async function (this: AdflowWorld) {
  await this.signIn('advertiser');
});
Given('I am signed in as an admin', async function (this: AdflowWorld) {
  await this.signIn('admin');
});

async function createCampaign(w: AdflowWorld, name: string) {
  const res = w.record(await w.api.createCampaign(w.token, campaignBody(name, 10_000, 50)));
  assert.equal(res.status, 201, `setup: create failed with ${res.status}`);
  w.campaign = res.body;
  w.createdIds.push(res.body.id);
  return res.body;
}

Given('a campaign named {string} exists', async function (this: AdflowWorld, name: string) {
  await createCampaign(this, name);
});
Given('{int} campaigns exist', async function (this: AdflowWorld, n: number) {
  for (let i = 1; i <= n; i++) await createCampaign(this, `Bulk Campaign ${i}`);
});
Given('I activate that campaign', async function (this: AdflowWorld) {
  const res = this.record(await this.api.updateCampaign(this.token, this.campaign!.id, { status: 'ACTIVE' }));
  assert.equal(res.status, 200);
  this.campaign = res.body;
});
Given('I hold a fresh token pair', async function (this: AdflowWorld) {
  const res = await this.api.login(config.advertiser.username, config.advertiser.password);
  assert.equal(res.status, 200);
  this.pair = res.body;
});

// ---------- When: auth ----------
When('an anonymous user lists campaigns', async function (this: AdflowWorld) {
  this.record(await this.api.listCampaigns(undefined));
});
When('a user with an invalid token lists campaigns', async function (this: AdflowWorld) {
  this.record(await this.api.listCampaigns('not-a-jwt'));
});
When('someone logs in as {string} with password {string}', async function (this: AdflowWorld, u: string, p: string) {
  this.record(await this.api.login(u, p));
});
When('I refresh with my refresh token', async function (this: AdflowWorld) {
  this.usedRefreshToken = this.pair!.refresh_token;
  this.record(await this.api.refresh(this.usedRefreshToken));
});
When('I refresh again with the same, already used, refresh token', async function (this: AdflowWorld) {
  this.record(await this.api.refresh(this.usedRefreshToken!));
});

// ---------- When: campaigns ----------
When(
  'I create a campaign named {string} with a daily budget of {int} cents and a max bid of {int} cents',
  async function (this: AdflowWorld, name: string, budget: number, bid: number) {
    const res = this.record(await this.api.createCampaign(this.token, campaignBody(name, budget, bid)));
    if (res.status === 201) {
      this.campaign = res.body;
      this.createdIds.push(res.body.id);
    }
  },
);
When(
  'I submit a campaign with name {string}, daily budget {float} and max bid {float}',
  async function (this: AdflowWorld, name: string, budget: number, bid: number) {
    this.record(await this.api.createCampaign(this.token, campaignBody(name, budget, bid)));
  },
);
When('I create a campaign with the extra field {string} set to {string}', async function (this: AdflowWorld, f: string, v: string) {
  this.record(await this.api.createCampaign(this.token, { ...campaignBody('Injected', 1000, 10), [f]: v }));
});
When('I fetch that campaign', async function (this: AdflowWorld) {
  this.record(await this.api.getCampaign(this.token, this.campaign!.id));
});
When('I fetch the campaign with id {string}', async function (this: AdflowWorld, id: string) {
  this.record(await this.api.getCampaign(this.token, id));
});
When('I list campaigns', async function (this: AdflowWorld) {
  this.record(await this.api.listCampaigns(this.token));
});
When('I list campaigns with page size {int}', async function (this: AdflowWorld, size: number) {
  this.record(await this.api.listCampaigns(this.token, { page: 1, pageSize: size }));
});
When('I list campaigns with status {string}', async function (this: AdflowWorld, status: string) {
  this.record(await this.api.listCampaigns(this.token, { status, pageSize: 100 }));
});
When(
  'I update that campaign to status {string} and daily budget {int} cents',
  async function (this: AdflowWorld, status: string, budget: number) {
    this.record(await this.api.updateCampaign(this.token, this.campaign!.id, { status, dailyBudgetCents: budget }));
  },
);
When('I update that campaign to status {string}', async function (this: AdflowWorld, status: string) {
  this.record(await this.api.updateCampaign(this.token, this.campaign!.id, { status }));
});
When('I delete that campaign', async function (this: AdflowWorld) {
  this.record(await this.api.deleteCampaign(this.token, this.campaign!.id));
});
When('I request the report for that campaign', async function (this: AdflowWorld) {
  this.record(await this.api.getReport(this.token, this.campaign!.id));
});
When('I request the report for the campaign with id {string}', async function (this: AdflowWorld, id: string) {
  this.record(await this.api.getReport(this.token, id));
});

// ---------- Then ----------
Then('the response status is {int}', function (this: AdflowWorld, status: number) {
  assert.equal(this.last.status, status, `body: ${JSON.stringify(this.last.body)}`);
});
Then('the response is a problem document with status {int}', function (this: AdflowWorld, status: number) {
  assert.match(this.last.contentType, /application\/problem\+json/);
  assert.equal(this.last.body.status, status);
  assert.ok(this.last.body.title);
  assert.ok(this.last.body.type);
});
Then('the problem lists at least one validation error', function (this: AdflowWorld) {
  assert.ok(Array.isArray(this.last.body.errors) && this.last.body.errors.length > 0);
});
Then('the campaign has status {string}', function (this: AdflowWorld, status: string) {
  assert.equal(this.last.body.status, status);
});
Then('the campaign has the name {string}', function (this: AdflowWorld, name: string) {
  assert.equal(this.last.body.name, name);
});
Then('the campaign has a daily budget of {int} cents', function (this: AdflowWorld, cents: number) {
  assert.equal(this.last.body.dailyBudgetCents, cents);
});
Then('the page contains {int} campaigns', function (this: AdflowWorld, n: number) {
  assert.equal(this.last.body.items.length, n);
});
Then('the page size is {int}', function (this: AdflowWorld, n: number) {
  assert.equal(this.last.body.pageSize, n);
});
Then('the total is at least {int}', function (this: AdflowWorld, n: number) {
  assert.ok(this.last.body.total >= n, `total ${this.last.body.total}`);
});
Then('every listed campaign has status {string}', function (this: AdflowWorld, status: string) {
  assert.ok(this.last.body.items.length > 0);
  for (const c of this.last.body.items) assert.equal(c.status, status);
});
Then('the listing includes that campaign', function (this: AdflowWorld) {
  assert.ok(this.last.body.items.some((c: { id: string }) => c.id === this.campaign!.id));
});
Then(
  'the report shows {int} impressions, {int} clicks and {int} cents spent',
  function (this: AdflowWorld, imp: number, clicks: number, spend: number) {
    assert.deepEqual(
      { i: this.last.body.impressions, c: this.last.body.clicks, s: this.last.body.spendCents },
      { i: imp, c: clicks, s: spend },
    );
  },
);
Then('the click-through rate is {int}', function (this: AdflowWorld, ctr: number) {
  assert.equal(this.last.body.ctr, ctr);
});
Then('the response conforms to the OpenAPI contract', function (this: AdflowWorld) {
  const result = this.validate(this.last);
  assert.ok(result.valid, `Contract violation: ${result.errors.join('; ')}`);
});
