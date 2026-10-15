import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CatalogItem, Command, PaymentMethod, SaleFlag } from '../shared/protocol';

export type SaleSyncState = 'pending' | 'synced' | 'flagged' | 'failed';

export interface LocalSaleLine {
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}
export interface LocalSale {
  id: string;
  createdAt: string;
  lines: LocalSaleLine[];
  totalCents: number;
  payment: PaymentMethod;
  note: string;
  syncState: SaleSyncState;
  flags: SaleFlag[];
  error?: string;
}

export interface OutboxEntry {
  /** Local sequence: defines apply order. */
  seq: number;
  command: Command;
  status: 'pending' | 'failed';
  attempts: number;
  /** Epoch ms before which the engine will not retry this entry (backoff). */
  nextAttemptAt: number;
  lastError?: string;
}

export interface PosDB extends DBSchema {
  catalog: { key: string; value: CatalogItem };
  meta: { key: string; value: { key: string; value: unknown } };
  sales: { key: string; value: LocalSale; indexes: { byCreated: string } };
  outbox: { key: number; value: OutboxEntry };
}
export type Db = IDBPDatabase<PosDB>;

export function openPosDb(name = 'adflow-pos'): Promise<Db> {
  return openDB<PosDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('catalog', { keyPath: 'sku' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('sales', { keyPath: 'id' }).createIndex('byCreated', 'createdAt');
      db.createObjectStore('outbox', { keyPath: 'seq' });
    },
  });
}
