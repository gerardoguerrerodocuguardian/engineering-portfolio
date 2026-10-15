import type { CatalogResponse, Command, SyncResponse } from '../shared/protocol';
import type { CatalogFetch, Transport } from './types';

export function httpTransport(base = '/api', fetchFn: typeof fetch = (...a) => fetch(...a)): Transport {
  return {
    async sync(deviceId: string, commands: Command[]): Promise<SyncResponse> {
      const res = await fetchFn(`${base}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId, commands }),
      });
      if (!res.ok) throw new Error(`sync failed: HTTP ${res.status}`);
      return (await res.json()) as SyncResponse;
    },
    async fetchCatalog({ since, etag }): Promise<CatalogFetch> {
      const qs = since ? `?since=${since}` : '';
      const res = await fetchFn(`${base}/catalog${qs}`, { headers: etag ? { 'if-none-match': etag } : {} });
      if (res.status === 304) return { status: 'not-modified' };
      if (!res.ok) throw new Error(`catalog failed: HTTP ${res.status}`);
      return { status: 'ok', etag: res.headers.get('etag'), data: (await res.json()) as CatalogResponse };
    },
  };
}
