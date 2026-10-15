import type { InfiniteData } from '@tanstack/react-query';
import type { Campaign, CampaignPage, CampaignStatus } from '@/api/types';

/** Pure helpers that rewrite cached data; kept out of hooks so they are trivially testable. */
export function setStatusInPages(
  data: InfiniteData<CampaignPage> | undefined,
  id: string,
  status: CampaignStatus,
): InfiniteData<CampaignPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((c) => (c.id === id ? { ...c, status } : c)),
    })),
  };
}

export function setStatusOnCampaign(campaign: Campaign | undefined, status: CampaignStatus): Campaign | undefined {
  return campaign ? { ...campaign, status } : campaign;
}
