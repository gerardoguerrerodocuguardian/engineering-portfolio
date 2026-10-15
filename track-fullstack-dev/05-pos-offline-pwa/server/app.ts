import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { PushMessage, SyncRequest, SyncResponse } from '../src/shared/protocol';
import { SyncStore } from './store';
import { validateBatchSize } from './validate';

export async function buildApp(store: SyncStore = new SyncStore()): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000 });
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true, catalogVersion: store.version }));

  // Catalog: ETag identifies the catalog *state* (version). `since` selects a delta; the URL differs per
  // `since`, so shared caches stay correct. A client already at the current version gets a bodyless 304.
  app.get<{ Querystring: { since?: string } }>('/catalog', async (req, reply) => {
    const etag = `"cat-v${store.version}"`;
    reply.header('ETag', etag).header('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    const since = req.query.since === undefined ? undefined : Number(req.query.since);
    if (since !== undefined && (!Number.isInteger(since) || since < 0)) {
      return reply.code(400).send({ error: 'since must be a non-negative integer' });
    }
    return store.getCatalog(since);
  });

  app.post<{ Body: SyncRequest }>('/sync', async (req, reply) => {
    const body = req.body;
    if (!body || typeof body.deviceId !== 'string' || !validateBatchSize(body.commands)) {
      return reply.code(400).send({ error: 'expected { deviceId, commands[<=100] }' });
    }
    const res: SyncResponse = { results: store.applyBatch(body.commands), catalogVersion: store.version };
    return res;
  });

  // Inspection/demo endpoints. A real deployment would put these behind authentication.
  app.get('/sales', async () => store.sales());

  app.post<{ Body: { sku?: string; priceCents?: number; active?: boolean } }>('/admin/prices', async (req, reply) => {
    const { sku, priceCents, active } = req.body ?? {};
    if (typeof sku !== 'string' || !Number.isInteger(priceCents) || (priceCents as number) < 0) {
      return reply.code(400).send({ error: 'sku and integer priceCents required' });
    }
    const item = store.setPrice(sku, priceCents as number, active);
    return item ? item : reply.code(404).send({ error: 'unknown sku' });
  });

  app.get('/ws', { websocket: true }, (socket) => {
    const hello: PushMessage = { type: 'hello', version: store.version };
    socket.send(JSON.stringify(hello));
  });

  const off = store.onCatalogChange((changed, version) => {
    const msg: PushMessage = { type: 'catalog', version, changed };
    const data = JSON.stringify(msg);
    for (const c of app.websocketServer.clients) if (c.readyState === 1) c.send(data);
  });
  app.addHook('onClose', async () => off());

  return app;
}
