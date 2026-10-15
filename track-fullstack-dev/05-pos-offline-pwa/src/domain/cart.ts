import type { CatalogItem } from '../shared/protocol';

export type Cart = ReadonlyArray<{ sku: string; qty: number }>;

export function addToCart(cart: Cart, sku: string, qty = 1): Cart {
  const q = Math.max(1, Math.min(999, Math.floor(qty)));
  const hit = cart.find((l) => l.sku === sku);
  if (!hit) return [...cart, { sku, qty: q }];
  return cart.map((l) => (l.sku === sku ? { ...l, qty: Math.min(999, l.qty + q) } : l));
}

/** qty <= 0 removes the line. */
export function setQty(cart: Cart, sku: string, qty: number): Cart {
  if (qty <= 0) return cart.filter((l) => l.sku !== sku);
  return cart.map((l) => (l.sku === sku ? { ...l, qty: Math.min(999, Math.floor(qty)) } : l));
}

/** Prices are derived from the live local catalog so a pushed price update reprices the open cart. */
export function priceCart(cart: Cart, catalog: ReadonlyMap<string, CatalogItem>) {
  const lines = cart.flatMap((l) => {
    const item = catalog.get(l.sku);
    return item ? [{ sku: l.sku, name: item.name, qty: l.qty, unitPriceCents: item.priceCents }] : [];
  });
  return { lines, totalCents: lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0) };
}

/** Quick entry: "AF-1001", "200000000001", or "3*AF-1001" (quantity prefix, as scanners/keyboards send it). */
export function parseQuickEntry(raw: string): { qty: number; code: string } | null {
  const m = /^\s*(?:(\d{1,3})\s*\*\s*)?(\S+)\s*$/.exec(raw);
  if (!m || !m[2]) return null;
  const qty = m[1] ? Number(m[1]) : 1;
  return qty >= 1 ? { qty, code: m[2] } : null;
}

export function findByCode(catalog: Iterable<CatalogItem>, code: string): CatalogItem | undefined {
  const c = code.toLowerCase();
  for (const i of catalog) if (i.active && (i.sku.toLowerCase() === c || i.barcode === code)) return i;
  return undefined;
}

export const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
