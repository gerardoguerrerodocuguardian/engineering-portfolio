import { describe, expect, it } from 'vitest';
import { SyncStore } from '../../server/store';
import { enqueueNoteUpdate, enqueueSale, listOutbox, listSales, requeueFailed } from '../../src/db/repo';
import { backoffDelay, createSyncEngine } from '../../src/sync/engine';
import { freshDb, LINE, storeTransport } from './helpers';

const clock = () => {
  const c = { t: 1_000_000 };
  return { c, now: () => c.t };
};

async function setup(store = new SyncStore()) {
  const db = await freshDb();
  const net = storeTransport(store);
  const { c, now } = clock();
  const engine = createSyncEngine({ db, transport: net.transport, now, random: () => 1, baseDelayMs: 1000, maxDelayMs: 8000, batchSize: 2 });
  return { db, store, net, engine, c };
}

describe('outbox', () => {
  it('commits sale and command atomically with increasing seq', async () => {
    const { db } = await setup();
    await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    await enqueueSale(db, { lines: [LINE], payment: 'card' });
    const box = await listOutbox(db);
    expect(box.map((e) => e.seq)).toEqual([1, 2]);
    expect((await listSales(db)).length).toBe(2);
    expect(new Set(box.map((e) => e.command.id)).size).toBe(2);
  });

  it('rejects an empty sale without writing anything', async () => {
    const { db } = await setup();
    await expect(enqueueSale(db, { lines: [], payment: 'cash' })).rejects.toThrow();
    expect(await listOutbox(db)).toHaveLength(0);
  });
});

describe('flush', () => {
  it('delivers in order across batches and clears the outbox', async () => {
    const { db, net, engine, store } = await setup();
    for (let i = 0; i < 5; i++) await enqueueSale(db, { lines: [{ ...LINE, qty: i + 1 }], payment: 'cash' });
    const report = await engine.flush();
    expect(report).toMatchObject({ reachable: true, applied: 5, remaining: 0 });
    expect(net.state.calls.map((b) => b.length)).toEqual([2, 2, 1]);
    expect(net.state.calls.flat().map((c) => c.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(store.sales().map((s) => s.lines[0]?.qty)).toEqual([1, 2, 3, 4, 5]);
    expect(await listOutbox(db)).toHaveLength(0);
    expect((await listSales(db)).every((s) => s.syncState === 'synced')).toBe(true);
  });

  it('offline: keeps everything queued and backs off exponentially, then recovers', async () => {
    const { db, net, engine, c, store } = await setup();
    await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    net.state.down = true;
    const r1 = await engine.flush();
    expect(r1).toMatchObject({ reachable: false, remaining: 1 });
    expect((await listOutbox(db))[0]).toMatchObject({ attempts: 1, nextAttemptAt: c.t + 1000 });

    // Inside the backoff window a normal flush does not even call the network.
    const calls = net.state.calls.length;
    await engine.flush();
    expect(net.state.calls.length).toBe(calls);

    // Manual retry (force) ignores the window; second failure doubles the delay.
    await engine.flush({ force: true });
    expect((await listOutbox(db))[0]).toMatchObject({ attempts: 2, nextAttemptAt: c.t + 2000 });

    net.state.down = false;
    const ok = await engine.flush({ force: true });
    expect(ok).toMatchObject({ reachable: true, applied: 1, remaining: 0 });
    expect(store.sales()).toHaveLength(1);
  });

  it('caps backoff and applies jitter', () => {
    expect(backoffDelay(1, 1000, 8000, () => 1)).toBe(1000);
    expect(backoffDelay(10, 1000, 8000, () => 1)).toBe(8000);
    expect(backoffDelay(3, 1000, 8000, () => 0)).toBe(2000);
  });

  it('is idempotent when the response is lost after the server applied the batch', async () => {
    const { db, net, engine, store } = await setup();
    await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    net.state.dropResponse = true;
    expect((await engine.flush()).reachable).toBe(false);
    expect(store.sales()).toHaveLength(1); // server has it, client does not know
    net.state.dropResponse = false;
    const report = await engine.flush({ force: true });
    expect(report).toMatchObject({ duplicates: 1, applied: 0, remaining: 0 });
    expect(store.sales()).toHaveLength(1); // still exactly once
    expect((await listSales(db))[0]?.syncState).toBe('synced');
  });

  it('concurrent flush calls share one in-flight request', async () => {
    const { db, net, engine } = await setup();
    await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    const [a, b] = await Promise.all([engine.flush(), engine.flush()]);
    expect(a).toBe(b);
    expect(net.state.calls).toHaveLength(1);
  });

  it('partial failure: transient error defers the rest of the batch and preserves order', async () => {
    const store = new SyncStore({ shouldFail: (cmd) => cmd.seq === 2 && !failedOnce.done && (failedOnce.done = true) });
    const failedOnce = { done: false };
    const { db, engine, c } = await setup(store);
    for (let i = 0; i < 3; i++) await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    const r1 = await engine.flush();
    expect(r1).toMatchObject({ applied: 1, retried: 1, remaining: 2 });
    expect(store.sales()).toHaveLength(1);
    // seq 3 must not overtake seq 2.
    expect((await listOutbox(db)).map((e) => e.seq)).toEqual([2, 3]);
    c.t += 5000;
    const r2 = await engine.flush();
    expect(r2).toMatchObject({ applied: 2, remaining: 0 });
    expect(store.sales()).toHaveLength(3);
  });

  it('permanent rejection parks the sale (never deleted), does not block others, manual retry requeues', async () => {
    const { db, engine, store } = await setup();
    const bad = await enqueueSale(db, { lines: [{ ...LINE, qty: 1000 }], payment: 'cash' }); // qty > 999 invalid
    await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    const r = await engine.flush();
    expect(r).toMatchObject({ applied: 1, rejected: 1, remaining: 0 });
    const box = await listOutbox(db);
    expect(box).toHaveLength(1);
    expect(box[0]).toMatchObject({ status: 'failed' });
    expect((await listSales(db)).find((s) => s.id === bad.id)).toMatchObject({ syncState: 'failed' });
    expect(store.sales()).toHaveLength(1);

    expect(await requeueFailed(db)).toBe(1);
    expect((await listOutbox(db))[0]).toMatchObject({ status: 'pending', attempts: 0 });
    expect((await listSales(db)).find((s) => s.id === bad.id)?.syncState).toBe('pending');
  });
});

describe('conflict resolution', () => {
  it('price changed while offline: sale is accepted at the quoted price and flagged', async () => {
    const { db, engine, store } = await setup();
    await enqueueSale(db, { lines: [{ ...LINE, qty: 2, unitPriceCents: 450 }], payment: 'cash' });
    store.setPrice('AF-1001', 500); // server-side change the offline till never saw
    await engine.flush();
    const sale = store.sales()[0]!;
    expect(sale.chargedCents).toBe(900); // customer keeps the price they were quoted
    expect(sale.listCents).toBe(1000); // server price is authoritative for reporting
    expect(sale.flags).toEqual([{ code: 'price_changed', sku: 'AF-1001', quotedCents: 450, currentCents: 500 }]);
    const local = (await listSales(db))[0]!;
    expect(local.syncState).toBe('flagged');
    expect(local.flags[0]?.code).toBe('price_changed');
  });

  it('unknown SKU never loses the sale', async () => {
    const { db, engine, store } = await setup();
    await enqueueSale(db, { lines: [{ sku: 'ZZ-9', name: 'Ghost', qty: 1, unitPriceCents: 100 }], payment: 'card' });
    await engine.flush();
    expect(store.sales()).toHaveLength(1);
    expect(store.sales()[0]?.flags[0]?.code).toBe('unknown_sku');
  });

  it('notes are last-writer-wins by client timestamp, regardless of arrival order', async () => {
    const { db, engine, store } = await setup();
    const sale = await enqueueSale(db, { lines: [LINE], payment: 'cash' });
    await engine.flush();
    await enqueueNoteUpdate(db, sale.id, 'newer', () => new Date('2030-01-02T00:00:00Z'));
    await enqueueNoteUpdate(db, sale.id, 'older', () => new Date('2030-01-01T00:00:00Z'));
    await engine.flush();
    expect(store.sales()[0]?.note).toBe('newer');
  });
});
