import type { Product } from '@/lib/catalog/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products, label }: { products: readonly Product[]; label: string }) {
  return (
    <ul className="grid" aria-label={label}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}
