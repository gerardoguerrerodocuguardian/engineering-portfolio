import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import { Campaign, CampaignReport, CampaignStatus } from '../core/models';
import { CampaignActions as A } from './campaign.actions';

export interface CampaignsState extends EntityState<Campaign> {
  page: number;
  pageSize: number;
  total: number;
  status: CampaignStatus | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  report: CampaignReport | null;
  reportLoading: boolean;
}

export const adapter = createEntityAdapter<Campaign>();

export const initialState: CampaignsState = adapter.getInitialState({
  page: 1,
  pageSize: 10,
  total: 0,
  status: null,
  loading: false,
  saving: false,
  error: null,
  report: null,
  reportLoading: false,
});

export const campaignsFeature = createFeature({
  name: 'campaigns',
  reducer: createReducer(
    initialState,
    on(A.opened, (s) => ({ ...s, loading: true, error: null })),
    on(A.statusFilterChanged, (s, { status }) => ({ ...s, status, page: 1, loading: true, error: null })),
    on(A.pageChanged, (s, { page }) => ({ ...s, page, loading: true, error: null })),
    // Replace the visible page: the list always mirrors the server's current page.
    on(A.loadSuccess, (s, { result }) =>
      adapter.setAll(result.items, {
        ...s,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        loading: false,
      }),
    ),
    on(A.loadFailure, A.loadOneFailure, A.reportFailure, (s, { error }) => ({
      ...s,
      loading: false,
      reportLoading: false,
      error,
    })),
    on(A.loadOneSuccess, (s, { campaign }) => adapter.upsertOne(campaign, s)),
    on(A.createRequested, A.updateRequested, A.deleteRequested, (s) => ({ ...s, saving: true, error: null })),
    on(A.createSuccess, (s, { campaign }) => adapter.addOne(campaign, { ...s, saving: false, total: s.total + 1 })),
    on(A.updateSuccess, (s, { campaign }) => adapter.upsertOne(campaign, { ...s, saving: false })),
    on(A.deleteSuccess, (s, { id }) => adapter.removeOne(id, { ...s, saving: false, total: Math.max(0, s.total - 1) })),
    on(A.saveFailure, (s, { error }) => ({ ...s, saving: false, error })),
    on(A.reportRequested, (s) => ({ ...s, report: null, reportLoading: true, error: null })),
    on(A.reportSuccess, (s, { report }) => ({ ...s, report, reportLoading: false })),
    on(A.errorDismissed, (s) => ({ ...s, error: null })),
  ),
});
