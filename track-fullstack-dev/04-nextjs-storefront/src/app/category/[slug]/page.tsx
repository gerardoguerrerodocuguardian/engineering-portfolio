import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/ProductGrid';
import { getCategory, listCategories, listProducts } from '@/lib/catalog/repository';

type Props = { params: Promise<{ slug: string }> };

// SSG: every category is rendered at build time; unknown slugs 404 instead of rendering on demand.
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return category
    ? { title: category.name, description: category.description, alternates: { canonical: `/category/${category.slug}` } }
    : {};
}

export default async function CategoryPage({ params }: Props) {
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  const items = await listProducts(category.slug);
  return (
    <>
      <h1>{category.name}</h1>
      <p>{category.description}</p>
      <ProductGrid products={items} label={`${category.name} products`} />
    </>
  );
}
