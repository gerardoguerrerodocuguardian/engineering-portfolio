import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openPosDb, type Db } from '../../src/db/db';
import { SyncStore } from '../../server/store';
import type { Command } from '../../src/shared/protocol';
import type { Transport } from '../../src/sync/types';

let n = 0;
export async function freshDb(): Promise<Db> {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return openPosDb(`test-${n++}`);
}

export const LINE = { sku: 'AF-1001', name: 'Notebook A5, ruled', qty: 2, unitPriceCents: 450 };

/** Transport wired straight into the real server store (no HTTP), with switchable network failure. */
export function storeTransport(store = new SyncStore()) {
  const state = { down: false, calls: [] as Command[][], dropResponse: false };
  const transport: Transport = {
    async sync(_device, commands) {
      state.calls.push(commands);
      if (state.down) throw new Error('network down');
      const results = store.applyBatch(commands);
      // Simulates "server applied it but the response was lost": the nastiest idempotency case.
      if (state.dropResponse) throw new Error('response lost');
      return { results, catalogVersion: store.version };
    },
    async fetchCatalog({ since, etag }) {
      if (state.down) throw new Error('network down');
      if (etag === `"cat-v${store.version}"`) return { status: 'not-modified' };
      return { status: 'ok', etag: `"cat-v${store.version}"`, data: store.getCatalog(since) };
    },
  };
  return { store, state, transport };
}
