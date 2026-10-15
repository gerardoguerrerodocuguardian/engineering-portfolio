import { Campaign } from './core/models';

export const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: 'c1',
  name: 'Test campaign',
  status: 'ACTIVE',
  dailyBudgetCents: 1000,
  maxBidCents: 50,
  keywords: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
