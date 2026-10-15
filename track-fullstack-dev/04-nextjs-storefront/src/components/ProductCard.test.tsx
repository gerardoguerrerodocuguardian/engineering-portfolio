import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { products } from '@/lib/catalog/data';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('links to the product and shows price', () => {
    const product = products[1]!;
    render(<ProductCard product={product} />);
    expect(screen.getByRole('link', { name: product.name })).toHaveAttribute('href', `/product/${product.slug}`);
    expect(screen.getByText('$59.00')).toBeInTheDocument();
    expect(screen.queryByText('Sponsored')).not.toBeInTheDocument();
  });

  it('labels sponsored products', () => {
    render(<ProductCard product={products[0]!} />);
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
