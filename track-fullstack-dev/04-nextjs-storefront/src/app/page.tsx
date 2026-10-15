import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/ProductGrid';
import { listCategories, listProducts } from '@/lib/catalog/repository';

// SSG: no dynamic APIs, no fetch with no-store -> prerendered at build time.
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const [categories, all] = await Promise.all([listCategories(), listProducts()]);
  const sponsored = all.filter((p) => p.sponsored);
  return (
    <>
      <h1>Everyday gear, honestly priced</h1>
      <p className="muted">Rendering: static (SSG), generated at build time.</p>
      <h2>Sponsored picks</h2>
      <ProductGrid products={sponsored} label="Sponsored products" />
      <h2>Shop by category</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/category/${c.slug}`}>{c.name}</Link> - {c.description}
          </li>
        ))}
      </ul>
    </>
  );
}
