'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getProductById } from '@/lib/catalog/repository';
import { CART_COOKIE, addToCart, countItems, parseCart, removeFromCart, serializeCart } from './cart';

export interface CartActionState {
  ok: boolean;
  count: number;
  message: string;
}

async function readCart() {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

async function writeCart(lines: ReturnType<typeof parseCart>) {
  (await cookies()).set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Server Action: validates the id server-side (never trust the form), then updates the cart cookie. */
export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const productId = String(formData.get('productId') ?? '');
  const product = await getProductById(productId);
  const current = await readCart();
  if (!product) return { ok: false, count: countItems(current), message: 'Product not found.' };

  const next = addToCart(current, product.id);
  await writeCart(next);
  revalidatePath('/cart');
  return { ok: true, count: countItems(next), message: `${product.name} added to cart.` };
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const productId = String(formData.get('productId') ?? '');
  await writeCart(removeFromCart(await readCart(), productId));
  revalidatePath('/cart');
}
