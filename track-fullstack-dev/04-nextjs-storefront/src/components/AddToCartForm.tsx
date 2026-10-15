'use client';

import { useActionState, useEffect } from 'react';
import { addToCartAction, type CartActionState } from '@/lib/cart/actions';
import { useCartStore } from '@/store/cart-store';

const initial: CartActionState = { ok: false, count: 0, message: '' };

/** Client Component only because of useActionState; the mutation itself runs on the server. */
export function AddToCartForm({
  productId,
  action = addToCartAction,
}: {
  productId: string;
  action?: (prev: CartActionState, formData: FormData) => Promise<CartActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const setCount = useCartStore((s) => s.setCount);
  const announce = useCartStore((s) => s.announce);

  useEffect(() => {
    if (state.message) {
      if (state.ok) setCount(state.count);
      announce(state.message);
    }
  }, [state, setCount, announce]);

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? 'Adding...' : 'Add to cart'}
      </button>
    </form>
  );
}
