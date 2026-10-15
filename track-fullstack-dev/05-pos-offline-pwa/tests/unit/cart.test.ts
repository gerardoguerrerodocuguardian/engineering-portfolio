import { describe, expect, it } from 'vitest';
import { seedCatalog } from '../../server/seed';
import { addToCart, findByCode, parseQuickEntry, priceCart, setQty } from '../../src/domain/cart';

describe('cart', () => {
  const catalog = new Map(seedCatalog().map((i) => [i.sku, i]));
  it('adds, merges, clamps and removes', () => {
    let c = addToCart([], 'AF-1001', 2);
    c = addToCart(c, 'AF-1001');
    expect(c).toEqual([{ sku: 'AF-1001', qty: 3 }]);
    expect(addToCart([], 'x', 5000)[0]?.qty).toBe(999);
    expect(setQty(c, 'AF-1001', 0)).toEqual([]);
  });
  it('prices from the live catalog', () => {
    const priced = priceCart([{ sku: 'AF-1001', qty: 2 }, { sku: 'NOPE', qty: 1 }], catalog);
    expect(priced.totalCents).toBe(900);
    expect(priced.lines).toHaveLength(1);
  });
  it('parses quick entry', () => {
    expect(parseQuickEntry('3*AF-1001')).toEqual({ qty: 3, code: 'AF-1001' });
    expect(parseQuickEntry(' 200000000001 ')).toEqual({ qty: 1, code: '200000000001' });
    expect(parseQuickEntry('0*AF-1001')).toBeNull();
    expect(parseQuickEntry('')).toBeNull();
  });
  it('finds by sku (case-insensitive) or barcode, skipping inactive items', () => {
    const items = seedCatalog();
    expect(findByCode(items, 'af-1003')?.sku).toBe('AF-1003');
    expect(findByCode(items, '200000000004')?.sku).toBe('AF-1004');
    const first = items[0]!;
    first.active = false;
    expect(findByCode(items, 'AF-1001')).toBeUndefined();
  });
});
