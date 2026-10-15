import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from '@/store/cart-store';
import { AddToCartForm } from './AddToCartForm';

vi.mock('@/lib/cart/actions', () => ({ addToCartAction: vi.fn() }));

describe('AddToCartForm', () => {
  beforeEach(() => useCartStore.setState({ count: 0, announcement: '' }));

  it('submits the product id and syncs the store', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, count: 2, message: 'Thing added to cart.' });
    render(<AddToCartForm productId="p-001" action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get('productId')).toBe('p-001');
    await vi.waitFor(() => expect(useCartStore.getState().count).toBe(2));
    expect(useCartStore.getState().announcement).toBe('Thing added to cart.');
  });
});
