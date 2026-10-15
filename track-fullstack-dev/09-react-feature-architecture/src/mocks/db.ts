import type { components } from '@/api/schema';

type Campaign = components['schemas']['Campaign'];

const names = ['Spring Launch', 'Back to School', 'Autumn Clearance', 'Holiday Teaser', 'Brand Awareness', 'Retargeting Q3', 'Video Pre-roll', 'Local Offers', 'Newsletter Boost', 'App Install Push'];
const statuses: Campaign['status'][] = ['ACTIVE', 'PAUSED', 'DRAFT', 'ACTIVE', 'EXHAUSTED'];

function seed(): Campaign[] {
  return names.map((name, i) => ({
    id: `cmp-${String(i + 1).padStart(3, '0')}`,
    name,
    status: statuses[i % statuses.length]!,
    dailyBudgetCents: 5_000 + i * 2_500,
    maxBidCents: 40 + i * 5,
    keywords: ['synthetic', `kw${i}`],
    createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
}

export let campaigns: Campaign[] = seed();
let counter = names.length;

export const nextId = () => `cmp-${String(++counter).padStart(3, '0')}`;
export const resetDb = () => {
  campaigns = seed();
  counter = names.length;
};
