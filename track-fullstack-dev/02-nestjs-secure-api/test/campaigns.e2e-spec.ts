import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import request from 'supertest';
import { Persistence } from '../src/campaigns/campaigns.module';
import { AppModule } from '../src/app.module';
import { buildOpenApi, configureApp } from '../src/app.setup';
import { InMemoryCampaignRepository } from '../src/campaigns/memory-campaign.repository';
import { CampaignRepository } from '../src/campaigns/campaign.repository';
import { TokenService } from '../src/auth/token.service';

describe('Campaign API (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: INestApplication;
  let conn: Connection;
  let mode: Persistence = 'memory';
  let admin: string;
  let advertiser: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    // Prefer a real (in-memory) mongod. If its binary cannot be downloaded (offline/proxied CI),
    // fall back to the in-memory repository so the HTTP/security layers are still verified.
    if (process.env.E2E_PERSISTENCE !== 'memory') {
      try {
        mongod = await MongoMemoryServer.create();
        process.env.MONGODB_URI = mongod.getUri('adflow_test');
        mode = 'mongo';
      } catch (e) {
        console.warn(`mongodb-memory-server unavailable, using in-memory repository: ${e}`);
      }
    }
    process.env.RATE_LIMIT_MAX = '10000';
    const mod = await Test.createTestingModule({ imports: [AppModule.register(mode)] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    if (mode === 'mongo') conn = app.get<Connection>(getConnectionToken());
    const tokens = app.get(TokenService);
    admin = tokens.issuePair('admin@adflow.test', 'ADMIN').access_token;
    advertiser = tokens.issuePair('advertiser@adflow.test', 'ADVERTISER').access_token;
  });

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const valid = { name: 'Autumn Sale', dailyBudgetCents: 50000, maxBidCents: 120, keywords: ['a'] };

  describe('security', () => {
    it('401 problem+json without token', async () => {
      const res = await http().get('/v1/campaigns').expect(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 401, title: 'Unauthorized' });
    });

    it('401 with garbage token', async () => {
      await http().get('/v1/campaigns').set(auth('not-a-jwt')).expect(401);
    });

    it('403 when ADVERTISER deletes', async () => {
      const res = await http()
        .delete('/v1/campaigns/65f0000000000000000000aa')
        .set(auth(advertiser))
        .expect(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('issues dev tokens and refreshes them (rotation, reuse rejected)', async () => {
      const t = await http()
        .post('/auth/token')
        .send({ username: 'advertiser@adflow.test', password: 'change-me-adv' })
        .expect(200);
      await http().get('/v1/campaigns').set(auth(t.body.access_token)).expect(200);
      const r = await http()
        .post('/auth/refresh')
        .send({ refreshToken: t.body.refresh_token })
        .expect(200);
      await http().get('/v1/campaigns').set(auth(r.body.access_token)).expect(200);
      await http().post('/auth/refresh').send({ refreshToken: t.body.refresh_token }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: t.body.access_token }).expect(401);
      await http().post('/auth/token').send({ username: 'x', password: 'y' }).expect(401);
    });

    it('health is public and sends helmet headers', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('validation', () => {
    it('400 problem+json for invalid DTO', async () => {
      const res = await http()
        .post('/v1/campaigns')
        .set(auth(advertiser))
        .send({ name: 'x', dailyBudgetCents: -1, maxBidCents: 0 })
        .expect(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.status).toBe(400);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('400 for unknown properties (forbidNonWhitelisted)', async () => {
      await http()
        .post('/v1/campaigns')
        .set(auth(advertiser))
        .send({ ...valid, ownerId: 'hacker' })
        .expect(400);
    });

    it('400 for out-of-range pagination', async () => {
      await http().get('/v1/campaigns?pageSize=500').set(auth(advertiser)).expect(400);
    });

    it('404 problem+json for unknown or malformed id', async () => {
      const res = await http().get('/v1/campaigns/nope').set(auth(advertiser)).expect(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      await http().get('/v1/campaigns/65f0000000000000000000aa').set(auth(advertiser)).expect(404);
    });
  });

  describe('lifecycle', () => {
    it('create, get, list, patch, delete', async () => {
      const created = await http()
        .post('/v1/campaigns')
        .set(auth(advertiser))
        .send(valid)
        .expect(201);
      const id = created.body.id as string;
      expect(created.body).toMatchObject({ ...valid, status: 'DRAFT' });
      expect(created.body.createdAt).toBeDefined();
      expect(created.body.ownerId).toBeUndefined();

      await http().get(`/v1/campaigns/${id}`).set(auth(advertiser)).expect(200);

      const list = await http()
        .get('/v1/campaigns?page=1&pageSize=5&status=DRAFT')
        .set(auth(advertiser))
        .expect(200);
      expect(list.body).toMatchObject({ page: 1, pageSize: 5 });
      expect(list.body.total).toBeGreaterThanOrEqual(1);
      expect(list.body.items.map((c: { id: string }) => c.id)).toContain(id);

      const patched = await http()
        .patch(`/v1/campaigns/${id}`)
        .set(auth(advertiser))
        .send({ status: 'ACTIVE', maxBidCents: 200 })
        .expect(200);
      expect(patched.body).toMatchObject({ status: 'ACTIVE', maxBidCents: 200, name: valid.name });

      await http().delete(`/v1/campaigns/${id}`).set(auth(admin)).expect(204);
      await http().get(`/v1/campaigns/${id}`).set(auth(admin)).expect(404);
    });

    it('paginates', async () => {
      for (let i = 0; i < 3; i++) {
        await http()
          .post('/v1/campaigns')
          .set(auth(admin))
          .send({ ...valid, name: `Page test ${i}` })
          .expect(201);
      }
      const p1 = await http().get('/v1/campaigns?page=1&pageSize=2').set(auth(admin)).expect(200);
      const p2 = await http().get('/v1/campaigns?page=2&pageSize=2').set(auth(admin)).expect(200);
      expect(p1.body.items).toHaveLength(2);
      expect(p2.body.items.length).toBeGreaterThanOrEqual(1);
      expect(p1.body.items[0].id).not.toBe(p2.body.items[0].id);
    });
  });

  describe('report aggregation', () => {
    it('aggregates impressions, clicks, spend and ctr from events', async () => {
      const created = await http().post('/v1/campaigns').set(auth(admin)).send(valid).expect(201);
      const id = created.body.id as string;
      const other = await http().post('/v1/campaigns').set(auth(admin)).send(valid).expect(201);
      const otherId = other.body.id as string;
      if (mode === 'mongo') {
        const cid = new Types.ObjectId(id);
        const oid = new Types.ObjectId(otherId);
        const ev = (campaignId: unknown, type: string, costCents = 0) => ({
          campaignId,
          type,
          costCents,
          occurredAt: new Date(),
        });
        await conn
          .collection('events')
          .insertMany([
            ...Array.from({ length: 8 }, () => ev(cid, 'IMPRESSION')),
            ev(cid, 'CLICK', 30),
            ev(cid, 'CLICK', 45),
            ev(oid, 'IMPRESSION'),
            ev(oid, 'CLICK', 999),
          ] as never[]);
      } else {
        const repo = app.get(CampaignRepository) as InMemoryCampaignRepository;
        for (let i = 0; i < 8; i++) repo.addEvent(id, 'IMPRESSION');
        repo.addEvent(id, 'CLICK', 30);
        repo.addEvent(id, 'CLICK', 45);
        repo.addEvent(otherId, 'IMPRESSION');
        repo.addEvent(otherId, 'CLICK', 999);
      }

      const res = await http().get(`/v1/campaigns/${id}/report`).set(auth(advertiser)).expect(200);
      expect(res.body).toEqual({
        campaignId: id,
        impressions: 8,
        clicks: 2,
        spendCents: 75,
        ctr: 0.25,
      });

      const empty = await http().post('/v1/campaigns').set(auth(admin)).send(valid).expect(201);
      const r0 = await http()
        .get(`/v1/campaigns/${empty.body.id}/report`)
        .set(auth(admin))
        .expect(200);
      expect(r0.body).toMatchObject({ impressions: 0, clicks: 0, spendCents: 0, ctr: 0 });
    });
  });

  describe('contract', () => {
    it('generated OpenAPI contains every path+method of the shared contract', () => {
      const file = join(__dirname, '../../../shared/contracts/campaign-api.openapi.yaml');
      const contract = parse(readFileSync(file, 'utf8'));
      const generated = buildOpenApi(app);
      const methods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const [path, item] of Object.entries<Record<string, unknown>>(contract.paths)) {
        expect(Object.keys(generated.paths)).toContain(path);
        for (const m of methods.filter((m) => m in item)) {
          expect(Object.keys(generated.paths[path])).toContain(m);
        }
      }
    });

    it('serves Swagger UI at /docs', async () => {
      await http().get('/docs').redirects(1).expect(200);
      await http().get('/docs-json').expect(200);
    });
  });
});
