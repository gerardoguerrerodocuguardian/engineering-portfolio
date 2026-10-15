import type { CatalogResponse, SyncResponse, Command } from '../shared/protocol';

export type CatalogFetch =
  | { status: 'not-modified' }
  | { status: 'ok'; etag: string | null; data: CatalogResponse };

/** Network seam. HTTP in the browser; an in-process adapter in tests. Throws on network/5xx errors. */
export interface Transport {
  sync(deviceId: string, commands: Command[]): Promise<SyncResponse>;
  fetchCatalog(opts: { since?: number; etag?: string }): Promise<CatalogFetch>;
}
