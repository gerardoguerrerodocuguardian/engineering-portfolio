import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'AdFlow - Campaign dashboard',
    loadComponent: () => import('./features/pages/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    title: 'Sign in - AdFlow',
    loadComponent: () => import('./features/pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'campaigns',
    canActivate: [authGuard],
    loadChildren: () => import('./features/campaigns/campaigns.routes').then((m) => m.CAMPAIGN_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
