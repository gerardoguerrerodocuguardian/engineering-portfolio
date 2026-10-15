import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Campaign, CampaignPage, CampaignReport, CampaignStatus, CreateCampaign, UpdateCampaign } from '../core/models';

export const CampaignActions = createActionGroup({
  source: 'Campaigns',
  events: {
    // user intents
    Opened: emptyProps(),
    'Status Filter Changed': props<{ status: CampaignStatus | null }>(),
    'Page Changed': props<{ page: number }>(),
    'Load One': props<{ id: string }>(),
    'Create Requested': props<{ body: CreateCampaign }>(),
    'Update Requested': props<{ id: string; body: UpdateCampaign }>(),
    'Delete Requested': props<{ id: string }>(),
    'Report Requested': props<{ id: string }>(),
    // API results
    'Load Success': props<{ result: CampaignPage }>(),
    'Load Failure': props<{ error: string }>(),
    'Load One Success': props<{ campaign: Campaign }>(),
    'Load One Failure': props<{ error: string }>(),
    'Create Success': props<{ campaign: Campaign }>(),
    'Update Success': props<{ campaign: Campaign }>(),
    'Delete Success': props<{ id: string }>(),
    'Save Failure': props<{ error: string }>(),
    'Report Success': props<{ report: CampaignReport }>(),
    'Report Failure': props<{ error: string }>(),
    'Error Dismissed': emptyProps(),
  },
});
