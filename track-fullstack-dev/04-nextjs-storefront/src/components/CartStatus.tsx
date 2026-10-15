'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useCartStore } from '@/store/cart-store';

/**
 * Header cart link + polite live region. The header lives in the root layout, so reading the
 * cookie there would force every page dynamic; instead the count is hydrated client-side
 * from /api/cart and kept in sync by the add-to-cart form through the store.
 */
export function CartStatus() {
  const count = useCartStore((s) => s.count);
  const announcement = useCartStore((s) => s.announcement);
  const setCount = useCartStore((s) => s.setCount);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/cart', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { count: number } | null) => body && setCount(body.count))
      .catch(() => undefined);
    return () => controller.abort();
  }, [setCount]);

  return (
    <>
      <Link href="/cart" data-testid="cart-link">
        Cart (<span data-testid="cart-count">{count}</span>)
      </Link>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
