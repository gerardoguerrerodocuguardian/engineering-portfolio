import { createSelector } from '@ngrx/store';
import { adapter, campaignsFeature } from './campaign.reducer';

const { selectAll, selectEntities } = adapter.getSelectors();

export const selectCampaignsState = campaignsFeature.selectCampaignsState;
export const selectAllCampaigns = createSelector(selectCampaignsState, selectAll);
export const selectCampaignEntities = createSelector(selectCampaignsState, selectEntities);

export const selectCampaignById = (id: string) =>
  createSelector(selectCampaignEntities, (entities) => entities[id] ?? null);

/** The server query (what the list effect needs to re-fetch). */
export const selectQuery = createSelector(
  campaignsFeature.selectPage,
  campaignsFeature.selectPageSize,
  campaignsFeature.selectStatus,
  (page, pageSize, status) => ({ page, pageSize, status }),
);

export const selectPageCount = createSelector(
  campaignsFeature.selectTotal,
  campaignsFeature.selectPageSize,
  (total, pageSize) => Math.max(1, Math.ceil(total / pageSize)),
);

/** View model for the list page. */
export const selectListVm = createSelector(
  selectAllCampaigns,
  campaignsFeature.selectPage,
  selectPageCount,
  campaignsFeature.selectTotal,
  campaignsFeature.selectStatus,
  campaignsFeature.selectLoading,
  campaignsFeature.selectError,
  (campaigns, page, pageCount, total, status, loading, error) => ({
    campaigns,
    page,
    pageCount,
    total,
    status,
    loading,
    error,
    hasPrev: page > 1,
    hasNext: page < pageCount,
  }),
);
