import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { buildApp } from '../../server/app';
import { SyncStore } from '../../server/store';
import type { CatalogResponse, PushMessage, SyncResponse } from '../../src/shared/protocol';

let app: FastifyInstance;
let store: SyncStore;
beforeEach(async () => {
  store = new SyncStore();
  app = await buildApp(store);
});
afterEach(() => app.close());

const sale = (id: string, saleId: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'CreateSale',
  deviceId: 'dev-1',
  seq: 1,
  createdAt: '2030-01-01T10:00:00.000Z',
  payload: { saleId, lines: [{ sku: 'AF-1001', qty: 2, unitPriceCents: 450, catalogVersion: 1 }], payment: { method: 'cash' } },
  ...over,
});
const post = (commands: unknown[]) => app.inject({ method: 'POST', url: '/sync', payload: { deviceId: 'dev-1', commands } });

describe('POST /sync', () => {
  it('applies once and replays as duplicate with the same outcome', async () => {
    const r1 = (await post([sale('c1', 's1')])).json<SyncResponse>();
    expect(r1.results[0]).toMatchObject({ id: 'c1', status: 'applied' });
    const r2 = (await post([sale('c1', 's1')])).json<SyncResponse>();
    expect(r2.results[0]).toMatchObject({ id: 'c1', status: 'duplicate' });
    expect(store.sales()).toHaveLength(1);
  });

  it('dedupes the same saleId under a different idempotency key', async () => {
    await post([sale('c1', 's1')]);
    const r = (await post([sale('c2', 's1')])).json<SyncResponse>();
    expect(r.results[0]?.status).toBe('duplicate');
    expect(store.sales()).toHaveLength(1);
  });

  it('returns per-command results: invalid ones are rejected, valid ones still apply', async () => {
    const bad = sale('c2', 's2', { payload: { saleId: 's2', lines: [], payment: { method: 'cash' } } });
    const r = (await post([sale('c1', 's1'), bad, { nonsense: true }, sale('c3', 's3')])).json<SyncResponse>();
    expect(r.results.map((x) => x.status)).toEqual(['applied', 'rejected', 'rejected', 'applied']);
    expect(store.sales().map((s) => s.saleId)).toEqual(['s1', 's3']);
  });

  it('flags price drift but keeps the quoted charge', async () => {
    store.setPrice('AF-1001', 600);
    const r = (await post([sale('c1', 's1')])).json<SyncResponse>();
    expect(r.results[0]?.flags[0]).toMatchObject({ code: 'price_changed', quotedCents: 450, currentCents: 600 });
    expect(store.sales()[0]).toMatchObject({ chargedCents: 900, listCents: 1200 });
  });

  it('rejects malformed bodies and oversized batches with 400', async () => {
    expect((await app.inject({ method: 'POST', url: '/sync', payload: { commands: [] } })).statusCode).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => sale(`c${i}`, `s${i}`));
    expect((await post(many)).statusCode).toBe(400);
  });
});

describe('GET /catalog', () => {
  it('serves full catalog with ETag, 304 on match, and deltas via since', async () => {
    const full = await app.inject({ url: '/catalog' });
    const etag = full.headers['etag'] as string;
    expect(etag).toBe('"cat-v1"');
    expect(full.json<CatalogResponse>()).toMatchObject({ full: true, version: 1 });
    expect((await app.inject({ url: '/catalog', headers: { 'if-none-match': etag } })).statusCode).toBe(304);

    await app.inject({ method: 'POST', url: '/admin/prices', payload: { sku: 'AF-1003', priceCents: 2000 } });
    const stale = await app.inject({ url: '/catalog?since=1', headers: { 'if-none-match': etag } });
    expect(stale.statusCode).toBe(200);
    const delta = stale.json<CatalogResponse>();
    expect(delta).toMatchObject({ full: false, version: 2 });
    expect(delta.items.map((i) => i.sku)).toEqual(['AF-1003']);
  });

  it('validates since', async () => {
    expect((await app.inject({ url: '/catalog?since=abc' })).statusCode).toBe(400);
  });
});

describe('WebSocket push', () => {
  it('broadcasts catalog changes to connected clients', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as { port: number }).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages: PushMessage[] = [];
    ws.on('message', (d) => messages.push(JSON.parse(String(d)) as PushMessage));
    await new Promise((r) => ws.once('open', r));
    await new Promise((r) => setTimeout(r, 50));
    store.setPrice('AF-1002', 777);
    await new Promise((r) => setTimeout(r, 100));
    ws.close();
    expect(messages[0]).toEqual({ type: 'hello', version: 1 });
    expect(messages[1]).toMatchObject({ type: 'catalog', version: 2 });
  });
});
