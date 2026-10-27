import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { landingGuard, roleGuard } from './guards/role.guard';

const placeholder = () => import('./pages/placeholder.page').then((m) => m.PlaceholderPage);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage),
  },

  { path: 'home', redirectTo: '', pathMatch: 'full' },

  {
    path: 'tabs',
    canActivate: [authGuard], // must be logged in
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },

      { path: 'faculty-home', canActivate: [roleGuard('faculty')], data: { title: 'Home' }, loadComponent: placeholder },
{
  path: 'new-report',
  canActivate: [roleGuard('faculty')],
  loadComponent: () => import('./pages/new-report.page').then((m) => m.NewReportPage),
},      { path: 'my-reports', canActivate: [roleGuard('faculty')], data: { title: 'My Reports' }, loadComponent: placeholder },

      { path: 'dashboard', canActivate: [roleGuard('admin')], data: { title: 'Dashboard' }, loadComponent: placeholder },
      { path: 'manage-reports', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/manage-reports.page').then((m) => m.ManageReportsPage) },      { path: 'control-center', canActivate: [roleGuard('admin')], data: { title: 'Control Center' }, loadComponent: placeholder },

      { path: 'assigned', canActivate: [roleGuard('personnel')], data: { title: 'Assigned Reports' }, loadComponent: placeholder },

      { path: 'account', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
    ],
  },

  { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },
  { path: '**', redirectTo: '' },
];