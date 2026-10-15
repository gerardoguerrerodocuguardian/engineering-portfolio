import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore } from './cart-store';

describe('cart store', () => {
  beforeEach(() => useCartStore.setState({ count: 0, announcement: '' }));

  it('sets count and never goes negative', () => {
    useCartStore.getState().setCount(3);
    expect(useCartStore.getState().count).toBe(3);
    useCartStore.getState().setCount(-2);
    expect(useCartStore.getState().count).toBe(0);
  });

  it('stores announcements', () => {
    useCartStore.getState().announce('Added');
    expect(useCartStore.getState().announcement).toBe('Added');
  });
});
