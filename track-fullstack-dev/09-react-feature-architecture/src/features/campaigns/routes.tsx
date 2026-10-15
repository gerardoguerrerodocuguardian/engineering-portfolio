import type { QueryClient } from '@tanstack/react-query';
import { campaignListQuery } from './api';
import { paramsFromUrl } from './CampaignsPage';

export { CampaignsPage as Component } from './CampaignsPage';

/** Starts the fetch before the component renders (render-as-you-fetch); Suspense still covers cache misses. */
export const loader = (qc: QueryClient) => async ({ request }: { request: Request }) => {
  void qc.prefetchQuery(campaignListQuery(paramsFromUrl(new URL(request.url).searchParams)));
  return null;
};
