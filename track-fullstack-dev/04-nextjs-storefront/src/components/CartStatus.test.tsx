import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from '@/store/cart-store';
import { CartStatus } from './CartStatus';

describe('CartStatus', () => {
  beforeEach(() => {
    useCartStore.setState({ count: 0, announcement: '' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 3 }))));
  });

  it('hydrates the count from /api/cart and exposes an aria-live region', async () => {
    render(<CartStatus />);
    expect(await screen.findByText('3')).toBeInTheDocument();
    act(() => useCartStore.getState().announce('Added'));
    expect(screen.getByRole('status')).toHaveTextContent('Added');
  });
});
