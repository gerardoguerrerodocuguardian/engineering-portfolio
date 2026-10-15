import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CART_COOKIE, parseCart } from '@/lib/cart/cart';
import { removeFromCartAction } from '@/lib/cart/actions';
import { formatPrice, getProductById } from '@/lib/catalog/repository';

// SSR: reads the cart cookie, so it is dynamic by construction.
export const metadata: Metadata = { title: 'Your cart', robots: { index: false } };

export default async function CartPage() {
  const lines = parseCart((await cookies()).get(CART_COOKIE)?.value);
  const rows = (
    await Promise.all(
      lines.map(async (l) => {
        const product = await getProductById(l.productId);
        return product ? { product, quantity: l.quantity } : null;
      }),
    )
  ).filter((r) => r !== null);
  const total = rows.reduce((sum, r) => sum + r.product.priceCents * r.quantity, 0);

  return (
    <>
      <h1>Your cart</h1>
      {rows.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <table>
          <caption className="sr-only">Cart contents</caption>
          <thead>
            <tr><th scope="col">Product</th><th scope="col">Qty</th><th scope="col">Subtotal</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map(({ product, quantity }) => (
              <tr key={product.id}>
                <th scope="row">{product.name}</th>
                <td>{quantity}</td>
                <td>{formatPrice(product.priceCents * quantity)}</td>
                <td>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button type="submit" aria-label={`Remove ${product.name}`}>Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={2}>Total</th><td colSpan={2}>{formatPrice(total)}</td></tr>
          </tfoot>
        </table>
      )}
    </>
  );
}
