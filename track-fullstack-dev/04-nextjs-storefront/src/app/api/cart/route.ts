import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { CART_COOKIE, countItems, parseCart } from '@/lib/cart/cart';

export const dynamic = 'force-dynamic';

export async function GET() {
  const lines = parseCart((await cookies()).get(CART_COOKIE)?.value);
  return NextResponse.json({ count: countItems(lines), lines }, { headers: { 'Cache-Control': 'no-store' } });
}
