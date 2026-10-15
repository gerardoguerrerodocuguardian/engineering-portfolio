import { categories, products } from './data';
import type { Category, CategorySlug, Product } from './types';

/**
 * Data-access layer. Pages never import `data.ts` directly, so swapping the synthetic
 * catalog for a real service only touches this file. Async on purpose: same shape as I/O.
 */
export async function listCategories(): Promise<readonly Category[]> {
  return categories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return categories.find((c) => c.slug === slug);
}

export async function listProducts(category?: CategorySlug): Promise<readonly Product[]> {
  return category ? products.filter((x) => x.category === category) : products;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return products.find((x) => x.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return products.find((x) => x.id === id);
}

/** Case-insensitive match on every whitespace-separated term, sponsored results first. */
export async function searchProducts(query: string): Promise<readonly Product[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return products
    .filter((x) => {
      const haystack = `${x.name} ${x.description} ${x.category}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    })
    .toSorted((a, b) => Number(b.sponsored) - Number(a.sponsored));
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
