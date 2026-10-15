/**
 * Hand-mirrored from shared/contracts/campaign-api.openapi.yaml (only what the app uses).
 * `contract.test.ts` fails if the enum or required fields drift from the YAML.
 */
export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  dailyBudgetCents: number;
  maxBidCents: number;
  keywords?: string[];
  createdAt: string;
}

export interface CampaignPage {
  items: Campaign[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UpdateCampaign {
  name?: string;
  status?: CampaignStatus;
  dailyBudgetCents?: number;
  maxBidCents?: number;
  keywords?: string[];
}

export interface CampaignReport {
  campaignId: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  /** clicks / impressions */
  ctr: number;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
}
