import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AddToCartForm } from '@/components/AddToCartForm';
import { formatPrice, getProductBySlug, listProducts } from '@/lib/catalog/repository';

type Props = { params: Promise<{ slug: string }> };

// ISR: prebuilt at build time, re-generated in the background at most once per minute.
export const revalidate = 60;

export async function generateStaticParams() {
  return (await listProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: product.description },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: { '@type': 'Offer', priceCurrency: 'USD', price: (product.priceCents / 100).toFixed(2) },
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Image className="hero-img" src={product.image} alt={product.name} width={600} height={450} priority sizes="(max-width: 640px) 100vw, 600px" style={{ maxWidth: 600 }} />
      <h1>{product.name}</h1>
      {product.sponsored && <span className="badge">Sponsored</span>}
      <p>{product.description}</p>
      <p className="price">{formatPrice(product.priceCents)}</p>
      <AddToCartForm productId={product.id} />
      <p className="muted">Rendering: ISR (revalidate every 60 s). Page built at {new Date().toISOString()}.</p>
    </article>
  );
}
