export interface CartLine {
  productId: string;
  quantity: number;
}

export const CART_COOKIE = 'adflow_cart';
export const MAX_QTY_PER_LINE = 10;

/** Cookie format: "p-001:2,p-004:1". Treated as untrusted input: malformed parts are dropped. */
export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  const lines: CartLine[] = [];
  for (const part of raw.split(',')) {
    const [productId, qty] = part.split(':');
    const quantity = Number(qty);
    if (productId && /^p-\d{3}$/.test(productId) && Number.isInteger(quantity) && quantity > 0) {
      lines.push({ productId, quantity: Math.min(quantity, MAX_QTY_PER_LINE) });
    }
  }
  return lines;
}

export function serializeCart(lines: readonly CartLine[]): string {
  return lines.map((l) => `${l.productId}:${l.quantity}`).join(',');
}

export function addToCart(lines: readonly CartLine[], productId: string, quantity = 1): CartLine[] {
  const existing = lines.find((l) => l.productId === productId);
  if (!existing) return [...lines, { productId, quantity: Math.min(quantity, MAX_QTY_PER_LINE) }];
  return lines.map((l) =>
    l.productId === productId ? { ...l, quantity: Math.min(l.quantity + quantity, MAX_QTY_PER_LINE) } : l,
  );
}

export function removeFromCart(lines: readonly CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId);
}

export function countItems(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
