import { NextResponse, type NextRequest } from 'next/server';
import { listProducts, searchProducts } from '@/lib/catalog/repository';
import type { CategorySlug } from '@/lib/catalog/types';

const CATEGORIES: readonly string[] = ['audio', 'home-office', 'outdoor'];

// GET /api/products?q=...&category=...
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const category = request.nextUrl.searchParams.get('category');
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  }
  const items = q ? await searchProducts(q) : await listProducts((category as CategorySlug | null) ?? undefined);
  return NextResponse.json({ items, total: items.length });
}
