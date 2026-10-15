import { CampaignStatus } from './schemas/campaign.schema';

export interface CampaignEntity {
  id: string;
  name: string;
  status: CampaignStatus;
  dailyBudgetCents: number;
  maxBidCents: number;
  keywords: string[];
  ownerId: string;
  createdAt: Date;
}

export interface NewCampaign {
  name: string;
  dailyBudgetCents: number;
  maxBidCents: number;
  keywords: string[];
  ownerId: string;
  status?: CampaignStatus;
}

export type CampaignPatch = Partial<Omit<NewCampaign, 'ownerId'>>;

export interface RawReport {
  impressions: number;
  clicks: number;
  spendCents: number;
}

/**
 * Persistence port. The service depends only on this abstraction, so it can be backed by
 * MongoDB (production) or the in-memory implementation (offline tests).
 */
export abstract class CampaignRepository {
  abstract create(data: NewCampaign): Promise<CampaignEntity>;
  abstract findById(id: string): Promise<CampaignEntity | null>;
  abstract findPage(
    page: number,
    pageSize: number,
    status?: CampaignStatus,
  ): Promise<{ items: CampaignEntity[]; total: number }>;
  abstract update(id: string, patch: CampaignPatch): Promise<CampaignEntity | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract aggregateReport(id: string): Promise<RawReport>;
}
