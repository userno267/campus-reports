import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { landingGuard, roleGuard } from './guards/role.guard';

// One lazy loader reused by every not-yet-built tab.
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

  // Login/register still navigate to '/home'. Send that to the role landing logic.
  { path: 'home', redirectTo: '', pathMatch: 'full' },

  {
    path: 'tabs',
    canActivate: [authGuard], // must be logged in
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      // /tabs by itself -> your role's first tab
      { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },

      // ----- Faculty tabs -----
      { path: 'faculty-home', canActivate: [roleGuard('faculty')], data: { title: 'Home' }, loadComponent: placeholder },
{
  path: 'new-report',
  canActivate: [roleGuard('faculty')],
  loadComponent: () => import('./pages/new-report.page').then((m) => m.NewReportPage),
},      { path: 'my-reports', canActivate: [roleGuard('faculty')], data: { title: 'My Reports' }, loadComponent: placeholder },

      // ----- Admin tabs -----
      { path: 'dashboard', canActivate: [roleGuard('admin')], data: { title: 'Dashboard' }, loadComponent: placeholder },
      { path: 'manage-reports', canActivate: [roleGuard('admin')], data: { title: 'Manage Reports' }, loadComponent: placeholder },
      { path: 'control-center', canActivate: [roleGuard('admin')], data: { title: 'Control Center' }, loadComponent: placeholder },

      // ----- Personnel tabs -----
      { path: 'assigned', canActivate: [roleGuard('personnel')], data: { title: 'Assigned Reports' }, loadComponent: placeholder },

      // ----- Everyone: temporary Account tab (your old home page) -----
      { path: 'account', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
    ],
  },

  // Empty URL and unknown URLs -> role landing (or login)
  { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },
  { path: '**', redirectTo: '' },
];