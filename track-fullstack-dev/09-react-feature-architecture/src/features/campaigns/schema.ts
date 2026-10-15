import { z } from 'zod';

/** Form-level schema. Mirrors CreateCampaign from the contract (min/max lengths, minimums); amounts are entered in USD. */
export const createCampaignSchema = z.object({
  name: z.string().trim().min(3, 'form.error.name').max(120, 'form.error.name'),
  dailyBudget: z.number('form.error.budget').min(0, 'form.error.budget'),
  maxBid: z.number('form.error.bid').min(0.01, 'form.error.bid'),
});
export type CreateCampaignValues = z.infer<typeof createCampaignSchema>;

export const toCents = (usd: number) => Math.round(usd * 100);
