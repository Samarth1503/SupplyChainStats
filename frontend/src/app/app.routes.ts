import { Routes } from '@angular/router';

// Each page is loaded lazily: its code is downloaded only when the user first visits it.
export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard | SupplyChainStats',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'analytics',
    title: 'Analytics | SupplyChainStats',
    loadComponent: () => import('./pages/analytics/analytics').then((m) => m.Analytics),
  },
  {
    path: '**',
    title: 'Page not found | SupplyChainStats',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
