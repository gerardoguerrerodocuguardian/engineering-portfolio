import { describe, expect, it } from 'vitest';
import { SyncStore } from '../../server/store';
import { getCatalog, getMeta } from '../../src/db/repo';
import { applyCatalogItems, refreshCatalog } from '../../src/sync/catalog';
import { freshDb, storeTransport } from './helpers';

describe('catalog sync', () => {
  it('full on first run, 304 when current, delta after a price change', async () => {
    const db = await freshDb();
    const { store, transport } = storeTransport(new SyncStore());
    expect((await refreshCatalog(db, transport)).changed).toBe(12);
    expect(await getMeta(db, 'catalogVersion')).toBe(1);
    expect((await refreshCatalog(db, transport)).changed).toBe(0);
    store.setPrice('AF-1002', 150);
    expect((await refreshCatalog(db, transport)).changed).toBe(1);
    expect((await getCatalog(db)).find((i) => i.sku === 'AF-1002')?.priceCents).toBe(150);
  });

  it('ignores stale pushes and never moves the version backwards', async () => {
    const db = await freshDb();
    const { store, transport } = storeTransport(new SyncStore());
    await refreshCatalog(db, transport);
    const item = store.setPrice('AF-1001', 999)!;
    expect(await applyCatalogItems(db, [item], item.version)).toHaveLength(1);
    expect(await applyCatalogItems(db, [{ ...item, priceCents: 1 }], 1)).toHaveLength(0);
    expect((await getCatalog(db)).find((i) => i.sku === 'AF-1001')?.priceCents).toBe(999);
  });
});
