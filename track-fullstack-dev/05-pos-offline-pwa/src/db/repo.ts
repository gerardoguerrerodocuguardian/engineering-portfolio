import type { CatalogItem, CreateSaleCommand, PaymentMethod, UpdateSaleNoteCommand } from '../shared/protocol';
import type { Db, LocalSale, LocalSaleLine, OutboxEntry } from './db';

export async function getMeta<T>(db: Db, key: string): Promise<T | undefined> {
  return (await db.get('meta', key))?.value as T | undefined;
}
export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.put('meta', { key, value });
}

export async function getDeviceId(db: Db): Promise<string> {
  const existing = await getMeta<string>(db, 'deviceId');
  if (existing) return existing;
  const id = `dev-${crypto.randomUUID()}`;
  await setMeta(db, 'deviceId', id);
  return id;
}

export async function getCatalog(db: Db): Promise<CatalogItem[]> {
  return db.getAll('catalog');
}

export interface NewSale {
  lines: LocalSaleLine[];
  payment: PaymentMethod;
  note?: string;
}

/**
 * The one write path for a sale: the sale record AND its outbox command are committed in a single IndexedDB
 * transaction. Either both exist or neither does, so a crash can never leave a sale that will not sync.
 */
export async function enqueueSale(db: Db, input: NewSale, now: () => Date = () => new Date()): Promise<LocalSale> {
  if (input.lines.length === 0) throw new Error('A sale needs at least one line');
  const deviceId = await getDeviceId(db);
  const catalogVersion = (await getMeta<number>(db, 'catalogVersion')) ?? 0;
  const tx = db.transaction(['meta', 'sales', 'outbox'], 'readwrite');
  const seq = ((await tx.objectStore('meta').get('seq'))?.value as number | undefined ?? 0) + 1;
  await tx.objectStore('meta').put({ key: 'seq', value: seq });
  const createdAt = now().toISOString();
  const saleId = `sale-${crypto.randomUUID()}`;
  const sale: LocalSale = {
    id: saleId,
    createdAt,
    lines: input.lines,
    totalCents: input.lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0),
    payment: input.payment,
    note: input.note ?? '',
    syncState: 'pending',
    flags: [],
  };
  const command: CreateSaleCommand = {
    id: `cmd-${crypto.randomUUID()}`,
    type: 'CreateSale',
    deviceId,
    seq,
    createdAt,
    payload: {
      saleId,
      lines: input.lines.map((l) => ({ sku: l.sku, qty: l.qty, unitPriceCents: l.unitPriceCents, catalogVersion })),
      payment: { method: input.payment },
      ...(input.note ? { note: input.note } : {}),
    },
  };
  await tx.objectStore('sales').put(sale);
  await tx.objectStore('outbox').put({ seq, command, status: 'pending', attempts: 0, nextAttemptAt: 0 });
  await tx.done;
  return sale;
}

export async function enqueueNoteUpdate(db: Db, saleId: string, note: string, now: () => Date = () => new Date()): Promise<void> {
  const deviceId = await getDeviceId(db);
  const tx = db.transaction(['meta', 'sales', 'outbox'], 'readwrite');
  const sale = await tx.objectStore('sales').get(saleId);
  if (!sale) throw new Error('Unknown sale');
  const seq = ((await tx.objectStore('meta').get('seq'))?.value as number | undefined ?? 0) + 1;
  await tx.objectStore('meta').put({ key: 'seq', value: seq });
  const updatedAt = now().toISOString();
  const command: UpdateSaleNoteCommand = {
    id: `cmd-${crypto.randomUUID()}`,
    type: 'UpdateSaleNote',
    deviceId,
    seq,
    createdAt: updatedAt,
    payload: { saleId, note, updatedAt },
  };
  await tx.objectStore('sales').put({ ...sale, note });
  await tx.objectStore('outbox').put({ seq, command, status: 'pending', attempts: 0, nextAttemptAt: 0 });
  await tx.done;
}

export async function listSales(db: Db, limit = 20): Promise<LocalSale[]> {
  const all = await db.getAllFromIndex('sales', 'byCreated');
  return all.reverse().slice(0, limit);
}

export async function listOutbox(db: Db): Promise<OutboxEntry[]> {
  return (await db.getAll('outbox')).sort((a, b) => a.seq - b.seq);
}

/** Manual retry: parked (failed) entries go back to the queue with a clean slate. */
export async function requeueFailed(db: Db): Promise<number> {
  const tx = db.transaction(['outbox', 'sales'], 'readwrite');
  let n = 0;
  for (const e of await tx.objectStore('outbox').getAll()) {
    if (e.status !== 'failed') continue;
    n += 1;
    await tx.objectStore('outbox').put({ ...e, status: 'pending', attempts: 0, nextAttemptAt: 0 });
    const saleId = e.command.payload.saleId;
    const sale = await tx.objectStore('sales').get(saleId);
    if (sale && sale.syncState === 'failed') await tx.objectStore('sales').put({ ...sale, syncState: 'pending' });
  }
  await tx.done;
  return n;
}
