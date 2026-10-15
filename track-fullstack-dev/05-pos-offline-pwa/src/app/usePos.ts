import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openPosDb, type Db, type LocalSale } from '../db/db';
import { enqueueNoteUpdate, enqueueSale, getCatalog, listOutbox, listSales, requeueFailed } from '../db/repo';
import { addToCart, findByCode, parseQuickEntry, priceCart, setQty, type Cart } from '../domain/cart';
import type { CatalogItem, PaymentMethod, PushMessage } from '../shared/protocol';
import { applyCatalogItems, refreshCatalog } from '../sync/catalog';
import { createSyncEngine } from '../sync/engine';
import { httpTransport } from '../sync/transport';

export type Connectivity = 'online' | 'offline' | 'syncing';

const transport = httpTransport();

export function usePos() {
  const [db, setDb] = useState<Db | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [cart, setCart] = useState<Cart>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const dbRef = useRef<Db | null>(null);

  const reload = useCallback(async () => {
    const d = dbRef.current;
    if (!d) return;
    const [c, s, o] = await Promise.all([getCatalog(d), listSales(d), listOutbox(d)]);
    setCatalog(c.sort((a, b) => a.sku.localeCompare(b.sku)));
    setSales(s);
    setPending(o.filter((e) => e.status === 'pending').length);
    setFailed(o.filter((e) => e.status === 'failed').length);
  }, []);

  const engine = useMemo(() => (db ? createSyncEngine({ db, transport }) : null), [db]);

  const sync = useCallback(
    async (force = false) => {
      const d = dbRef.current;
      if (!d || !engine) return;
      setSyncing(true);
      try {
        const report = await engine.flush({ force });
        // Push first, then pull: sales quoted at the old price reach the server before the new prices land locally.
        const pulled = await refreshCatalog(d, transport).then(() => true, () => false);
        setOnline(report.reachable && pulled);
        if (report.applied + report.duplicates > 0) setMessage(`Synced ${report.applied + report.duplicates} sale command(s).`);
        else if (!report.reachable) setMessage('Server unreachable. Sales are safe on this device and will retry.');
      } finally {
        setSyncing(false);
        await reload();
      }
    },
    [engine, reload],
  );

  useEffect(() => {
    let cancelled = false;
    void openPosDb().then((d) => {
      if (cancelled) return;
      dbRef.current = d;
      setDb(d);
      void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!engine) return;
    void sync();
    const onOnline = () => {
      setOnline(true);
      void sync(true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = window.setInterval(() => void sync(), 15_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, [engine, sync]);

  // Server push: catalog/price updates arrive over WebSocket; reconnect with a fixed delay.
  useEffect(() => {
    if (!db) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry: number | undefined;
    const connect = () => {
      if (stopped || !navigator.onLine) {
        retry = window.setTimeout(connect, 3000);
        return;
      }
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as PushMessage;
        if (msg.type === 'catalog') {
          void applyCatalogItems(db, msg.changed, msg.version).then(async (changed) => {
            if (changed.length > 0) setMessage(`Price update received for ${changed.map((c) => c.sku).join(', ')}.`);
            else await refreshCatalog(db, transport); // gap in versions: fall back to delta pull
            await reload();
          });
        }
      };
      ws.onclose = () => {
        if (!stopped) retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      ws?.close();
    };
  }, [db, reload]);

  const catalogMap = useMemo(() => new Map(catalog.map((i) => [i.sku, i])), [catalog]);
  const priced = useMemo(() => priceCart(cart, catalogMap), [cart, catalogMap]);

  const scan = useCallback(
    (raw: string): boolean => {
      const parsed = parseQuickEntry(raw);
      const item = parsed ? findByCode(catalog, parsed.code) : undefined;
      if (!parsed || !item) {
        setMessage(`Unknown code: ${raw.trim() || '(empty)'}`);
        return false;
      }
      setCart((c) => addToCart(c, item.sku, parsed.qty));
      setMessage(`Added ${parsed.qty} x ${item.name}`);
      return true;
    },
    [catalog],
  );

  const add = useCallback((sku: string) => {
    setCart((c) => addToCart(c, sku));
    const name = catalogMap.get(sku)?.name ?? sku;
    setMessage(`Added ${name}`);
  }, [catalogMap]);

  const changeQty = useCallback((sku: string, qty: number) => setCart((c) => setQty(c, sku, qty)), []);

  const pay = useCallback(
    async (method: PaymentMethod) => {
      const d = dbRef.current;
      if (!d || priced.lines.length === 0) return;
      // Optimistic: the sale is complete for the cashier the moment it is durable locally.
      const sale = await enqueueSale(d, { lines: priced.lines, payment: method });
      setCart([]);
      setMessage(`Sale completed (${method}). ${navigator.onLine ? 'Syncing...' : 'Stored offline; will sync when back online.'}`);
      await reload();
      const reg = await navigator.serviceWorker?.ready.catch(() => undefined);
      const syncMgr = (reg as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined)?.sync;
      await syncMgr?.register('flush-outbox').catch(() => undefined);
      if (navigator.onLine) void sync();
      return sale;
    },
    [priced.lines, reload, sync],
  );

  const annotate = useCallback(
    async (saleId: string, note: string) => {
      const d = dbRef.current;
      if (!d) return;
      await enqueueNoteUpdate(d, saleId, note);
      await reload();
      if (navigator.onLine) void sync();
    },
    [reload, sync],
  );

  const retryNow = useCallback(async () => {
    const d = dbRef.current;
    if (!d) return;
    await requeueFailed(d);
    await sync(true);
  }, [sync]);

  const connectivity: Connectivity = !online ? 'offline' : syncing ? 'syncing' : 'online';

  return { ready: db !== null, catalog, sales, pending, failed, cart, priced, connectivity, message, scan, add, changeQty, pay, annotate, retryNow };
}
