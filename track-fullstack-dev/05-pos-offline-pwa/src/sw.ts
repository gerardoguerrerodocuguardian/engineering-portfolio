/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { openPosDb } from './db/db';
import { createSyncEngine } from './sync/engine';
import { httpTransport } from './sync/transport';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

// App shell: every built asset is precached, navigations fall back to index.html. API calls are NOT cached
// here: the source of truth for data is IndexedDB, kept fresh by the sync engine.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Background Sync (Chromium): the browser fires this when connectivity returns, even if the tab is closed.
// If the sync fails the event rejects and the browser retries with its own backoff.
self.addEventListener('sync', (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag !== 'flush-outbox') return;
  e.waitUntil(
    (async () => {
      const db = await openPosDb();
      const report = await createSyncEngine({ db, transport: httpTransport() }).flush({ force: true });
      if (!report.reachable) throw new Error('still offline');
    })(),
  );
});
