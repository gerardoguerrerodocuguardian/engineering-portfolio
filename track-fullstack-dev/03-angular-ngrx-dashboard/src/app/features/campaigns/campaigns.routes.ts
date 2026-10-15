import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { CampaignEffects } from '../../store/campaign.effects';
import { campaignsFeature } from '../../store/campaign.reducer';

/** The campaigns slice and its effects are registered only when this chunk loads. */
export const CAMPAIGN_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(campaignsFeature), provideEffects(CampaignEffects)],
    children: [
      {
        path: '',
        title: 'Campaigns - AdFlow',
        loadComponent: () => import('./campaign-list.component').then((m) => m.CampaignListComponent),
      },
      {
        path: 'new',
        title: 'New campaign - AdFlow',
        loadComponent: () => import('./campaign-form.component').then((m) => m.CampaignFormComponent),
      },
      {
        path: ':id/edit',
        title: 'Edit campaign - AdFlow',
        loadComponent: () => import('./campaign-form.component').then((m) => m.CampaignFormComponent),
      },
      {
        path: ':id/report',
        title: 'Campaign report - AdFlow',
        loadComponent: () => import('./campaign-report.component').then((m) => m.CampaignReportComponent),
      },
    ],
  },
];
