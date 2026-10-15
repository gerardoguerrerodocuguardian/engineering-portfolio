import type { CatalogItem } from '../src/shared/protocol';

// Synthetic catalog for the fictional "AdFlow Retail" store.
const raw: Array<[string, string, number]> = [
  ['AF-1001', 'Notebook A5, ruled', 450],
  ['AF-1002', 'Gel pen, blue', 120],
  ['AF-1003', 'Desk lamp, LED', 2490],
  ['AF-1004', 'USB-C cable 1m', 899],
  ['AF-1005', 'Sticky notes x5', 325],
  ['AF-1006', 'Water bottle 750ml', 1290],
  ['AF-1007', 'Canvas tote bag', 750],
  ['AF-1008', 'Wireless mouse', 1599],
  ['AF-1009', 'Phone stand', 599],
  ['AF-1010', 'Highlighters x4', 410],
  ['AF-1011', 'Stapler, compact', 680],
  ['AF-1012', 'Mouse pad XL', 1090],
];

export function seedCatalog(): CatalogItem[] {
  return raw.map(([sku, name, priceCents], i) => ({
    sku,
    name,
    priceCents,
    barcode: `20000000${String(i + 1).padStart(4, '0')}`,
    active: true,
    version: 1,
  }));
}
