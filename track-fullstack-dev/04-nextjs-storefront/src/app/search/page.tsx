import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/ProductGrid';
import { searchProducts } from '@/lib/catalog/repository';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// SSR: depends on the query string, so it renders per request (never cached).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search', robots: { index: false } };

async function Results({ query }: { query: string }) {
  const hits = await searchProducts(query);
  if (hits.length === 0) return <p>No products match &quot;{query}&quot;.</p>;
  return (
    <>
      <p role="status">{hits.length} result{hits.length === 1 ? '' : 's'} for &quot;{query}&quot;</p>
      <ProductGrid products={hits} label="Search results" />
    </>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 80) ?? '';
  return (
    <>
      <h1>Search</h1>
      {query ? (
        // Streams: the shell is sent immediately, results replace the fallback when ready.
        <Suspense key={query} fallback={<div className="skeleton" role="status" aria-label="Searching" />}>
          <Results query={query} />
        </Suspense>
      ) : (
        <p>Type a product name in the search box.</p>
      )}
    </>
  );
}
