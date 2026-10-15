import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/catalog/repository';
import type { Product } from '@/lib/catalog/types';

/** Server Component: no client JS shipped for the card itself. */
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  return (
    <article className="card" aria-labelledby={`name-${product.id}`}>
      <Image
        src={product.image}
        alt=""
        width={600}
        height={450}
        sizes="(max-width: 640px) 100vw, 25vw"
        priority={priority}
      />
      <h3 id={`name-${product.id}`}>
        <Link href={`/product/${product.slug}`}>{product.name}</Link>
      </h3>
      {product.sponsored && <span className="badge">Sponsored</span>}
      <p className="price">{formatPrice(product.priceCents)}</p>
    </article>
  );
}
