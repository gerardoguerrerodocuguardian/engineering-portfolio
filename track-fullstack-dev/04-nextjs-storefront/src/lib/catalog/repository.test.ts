import { describe, expect, it } from 'vitest';
import { formatPrice, getProductBySlug, listProducts, searchProducts } from './repository';

describe('catalog repository', () => {
  it('filters by category', async () => {
    const items = await listProducts('audio');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.category === 'audio')).toBe(true);
  });

  it('finds a product by slug', async () => {
    expect((await getProductBySlug('pebble-bluetooth-speaker'))?.id).toBe('p-002');
    expect(await getProductBySlug('nope')).toBeUndefined();
  });

  it('search requires every term and ranks sponsored first', async () => {
    const hits = await searchProducts('  HEADPHONES over-ear ');
    expect(hits.map((h) => h.id)).toEqual(['p-001']);
    const all = await searchProducts('a');
    expect(all[0]?.sponsored).toBe(true);
  });

  it('empty query returns nothing', async () => {
    expect(await searchProducts('   ')).toEqual([]);
  });

  it('formats prices', () => {
    expect(formatPrice(12900)).toBe('$129.00');
  });
});
