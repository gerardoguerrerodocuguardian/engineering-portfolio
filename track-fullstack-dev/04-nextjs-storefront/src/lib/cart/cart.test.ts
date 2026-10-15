import { describe, expect, it } from 'vitest';
import { addToCart, countItems, parseCart, removeFromCart, serializeCart } from './cart';

describe('cart helpers', () => {
  it('round-trips through the cookie format', () => {
    const lines = [{ productId: 'p-001', quantity: 2 }, { productId: 'p-004', quantity: 1 }];
    expect(parseCart(serializeCart(lines))).toEqual(lines);
  });

  it('drops malformed or hostile cookie parts and clamps quantity', () => {
    expect(parseCart('p-001:2,evil:1,p-002:-3,p-003:abc,p-004:99,<script>')).toEqual([
      { productId: 'p-001', quantity: 2 },
      { productId: 'p-004', quantity: 10 },
    ]);
    expect(parseCart(undefined)).toEqual([]);
  });

  it('adds without mutating, merging existing lines', () => {
    const base = [{ productId: 'p-001', quantity: 1 }];
    const next = addToCart(base, 'p-001');
    expect(next).toEqual([{ productId: 'p-001', quantity: 2 }]);
    expect(base[0]?.quantity).toBe(1);
    expect(addToCart(next, 'p-002')).toHaveLength(2);
  });

  it('removes and counts', () => {
    const lines = [{ productId: 'p-001', quantity: 2 }, { productId: 'p-002', quantity: 3 }];
    expect(countItems(lines)).toBe(5);
    expect(removeFromCart(lines, 'p-001')).toEqual([{ productId: 'p-002', quantity: 3 }]);
  });
});
