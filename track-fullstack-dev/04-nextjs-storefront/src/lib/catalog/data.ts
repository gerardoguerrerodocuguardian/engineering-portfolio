import type { Category, Product } from './types';

export const categories: readonly Category[] = [
  { slug: 'audio', name: 'Audio', description: 'Headphones and speakers for focused work and play.' },
  { slug: 'home-office', name: 'Home office', description: 'Desk gear that keeps long days comfortable.' },
  { slug: 'outdoor', name: 'Outdoor', description: 'Light, durable gear for weekends away.' },
];

const p = (
  id: string,
  name: string,
  category: Product['category'],
  priceCents: number,
  description: string,
  sponsored = false,
): Product => ({
  id,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  category,
  description,
  priceCents,
  sponsored,
  image: `/products/${category}.svg`,
});

// Synthetic catalog: invented products, no real brands.
export const products: readonly Product[] = [
  p('p-001', 'Nimbus Over-Ear Headphones', 'audio', 12900, 'Closed-back headphones with a warm, balanced sound.', true),
  p('p-002', 'Pebble Bluetooth Speaker', 'audio', 5900, 'Pocket speaker with ten hours of playback.'),
  p('p-003', 'Echo Studio Earbuds', 'audio', 8900, 'Wireless earbuds with a compact charging case.'),
  p('p-004', 'Lumen Desk Lamp', 'home-office', 4500, 'Dimmable LED lamp with a flicker-free driver.'),
  p('p-005', 'Atlas Standing Desk Mat', 'home-office', 3900, 'Anti-fatigue mat for standing desks.', true),
  p('p-006', 'Keystone Mechanical Keyboard', 'home-office', 10900, 'Tenkeyless keyboard with tactile switches.'),
  p('p-007', 'Orbit Monitor Arm', 'home-office', 7900, 'Single monitor arm with cable management.'),
  p('p-008', 'Ridge Trail Backpack', 'outdoor', 9900, 'Twenty-eight litre pack with a rain cover.', true),
  p('p-009', 'Summit Insulated Bottle', 'outdoor', 2900, 'Keeps drinks cold for a day, hot for twelve hours.'),
  p('p-010', 'Drift Camp Hammock', 'outdoor', 4900, 'Ultralight hammock with tree-friendly straps.'),
  p('p-011', 'Ember Pocket Stove', 'outdoor', 3500, 'Folding stove for one-pot meals.'),
  p('p-012', 'Cairn Trekking Poles', 'outdoor', 6900, 'Pair of collapsible carbon poles.'),
];
