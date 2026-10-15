import type { MetadataRoute } from 'next';
import { listCategories, listProducts } from '@/lib/catalog/repository';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...categories.map((c) => ({ url: `${SITE_URL}/category/${c.slug}`, changeFrequency: 'weekly' as const })),
    ...products.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, changeFrequency: 'weekly' as const })),
  ];
}
