import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatMoney } from '../domain/cart';
import type { LocalSale } from '../db/db';
import { usePos } from './usePos';

const STATE_LABEL: Record<LocalSale['syncState'], string> = {
  pending: 'Waiting to sync',
  synced: 'Synced',
  flagged: 'Synced, needs review',
  failed: 'Rejected, needs review',
};

export function App() {
  const pos = usePos();
  const [code, setCode] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // F2 jumps back to the scan field from anywhere (keyboard-first cashiers).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pos.scan(code)) setCode('');
    scanRef.current?.focus();
  };

  const label = { online: 'Online', offline: 'Offline', syncing: 'Syncing' }[pos.connectivity];

  return (
    <>
      <a className="skip" href="#cart">Skip to cart</a>
      <header className="bar">
        <h1>AdFlow Retail POS</h1>
        <div className="status" role="status" aria-label="Connection status">
          <span className={`dot ${pos.connectivity}`} aria-hidden="true" />
          <strong>{label}</strong>
          <span>{pos.pending} to sync</span>
          {pos.failed > 0 && <span className="warn">{pos.failed} need review</span>}
          <button type="button" onClick={() => void pos.retryNow()} disabled={!pos.ready}>
            Retry sync
          </button>
        </div>
      </header>

      <p className="live" role="status" aria-live="polite">{pos.message}</p>

      <main className="layout">
        <section aria-labelledby="catalog-h">
          <h2 id="catalog-h">Catalog</h2>
          <form onSubmit={submit} className="scan">
            <label htmlFor="scan">Scan or type SKU / barcode (use 3*AF-1001 for quantity; F2 to focus)</label>
            <div className="row">
              <input id="scan" ref={scanRef} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus inputMode="text" />
              <button type="submit">Add</button>
            </div>
          </form>
          {pos.ready && pos.catalog.length === 0 && <p>Loading catalog. The first launch needs a connection.</p>}
          <ul className="grid">
            {pos.catalog.filter((i) => i.active).map((i) => (
              <li key={i.sku}>
                <button type="button" className="tile" onClick={() => pos.add(i.sku)} aria-label={`Add ${i.name}, ${formatMoney(i.priceCents)}`}>
                  <span>{i.name}</span>
                  <small>{i.sku}</small>
                  <b>{formatMoney(i.priceCents)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside>
          <section id="cart" aria-labelledby="cart-h" tabIndex={-1}>
            <h2 id="cart-h">Current sale</h2>
            {pos.priced.lines.length === 0 ? (
              <p>No items yet.</p>
            ) : (
              <ul className="lines">
                {pos.priced.lines.map((l) => (
                  <li key={l.sku}>
                    <span>{l.name}</span>
                    <span className="qty">
                      <button type="button" aria-label={`Decrease ${l.name}`} onClick={() => pos.changeQty(l.sku, l.qty - 1)}>-</button>
                      <output aria-label={`Quantity of ${l.name}`}>{l.qty}</output>
                      <button type="button" aria-label={`Increase ${l.name}`} onClick={() => pos.changeQty(l.sku, l.qty + 1)}>+</button>
                    </span>
                    <span>{formatMoney(l.qty * l.unitPriceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="total">Total <strong>{formatMoney(pos.priced.totalCents)}</strong></p>
            <div className="row">
              <button type="button" className="primary" disabled={pos.priced.lines.length === 0} onClick={() => void pos.pay('cash')}>
                Pay cash
              </button>
              <button type="button" className="primary" disabled={pos.priced.lines.length === 0} onClick={() => void pos.pay('card')}>
                Pay card (simulated)
              </button>
            </div>
          </section>

          <section aria-labelledby="recent-h">
            <h2 id="recent-h">Recent sales</h2>
            <ul className="sales" data-testid="recent-sales">
              {pos.sales.map((s) => (
                <li key={s.id} data-state={s.syncState}>
                  <span>{new Date(s.createdAt).toLocaleTimeString()} · {formatMoney(s.totalCents)}</span>
                  <span className={`badge ${s.syncState}`}>{STATE_LABEL[s.syncState]}</span>
                  {s.flags.map((f, n) => (
                    <small key={n} className="flag">
                      {f.code === 'price_changed' && `${f.sku}: price is now ${formatMoney(f.currentCents ?? 0)} (charged ${formatMoney(f.quotedCents ?? 0)})`}
                      {f.code === 'unknown_sku' && `${f.sku}: unknown to server`}
                      {f.code === 'inactive_sku' && `${f.sku}: discontinued`}
                      {f.code === 'stale_note_ignored' && 'Older note ignored'}
                    </small>
                  ))}
                  {s.error && <small className="flag">{s.error}</small>}
                </li>
              ))}
              {pos.sales.length === 0 && <li>No sales yet.</li>}
            </ul>
          </section>
        </aside>
      </main>
    </>
  );
}
