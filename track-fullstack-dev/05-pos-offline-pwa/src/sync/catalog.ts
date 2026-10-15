import type { Db } from '../db/db';
import { getMeta } from '../db/repo';
import type { CatalogItem } from '../shared/protocol';
import type { Transport } from './types';

/** Pulls the catalog: full on first run, then `since=<localVersion>` deltas guarded by If-None-Match. */
export async function refreshCatalog(db: Db, transport: Transport): Promise<{ changed: number; version: number }> {
  const version = (await getMeta<number>(db, 'catalogVersion')) ?? 0;
  const etag = version > 0 ? `"cat-v${version}"` : undefined;
  const res = await transport.fetchCatalog({ ...(version > 0 ? { since: version } : {}), ...(etag ? { etag } : {}) });
  if (res.status === 'not-modified') return { changed: 0, version };
  return { changed: (await applyCatalogItems(db, res.data.items, res.data.version, res.data.full)).length, version: res.data.version };
}

/** Shared by HTTP refresh and WebSocket push. Never moves the local version backwards. */
export async function applyCatalogItems(db: Db, items: CatalogItem[], version: number, full = false): Promise<CatalogItem[]> {
  const tx = db.transaction(['catalog', 'meta'], 'readwrite');
  const current = ((await tx.objectStore('meta').get('catalogVersion'))?.value as number | undefined) ?? 0;
  if (!full && version <= current) {
    await tx.done;
    return [];
  }
  if (full) await tx.objectStore('catalog').clear();
  for (const i of items) await tx.objectStore('catalog').put(i);
  await tx.objectStore('meta').put({ key: 'catalogVersion', value: version });
  await tx.done;
  return items;
}
