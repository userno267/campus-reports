import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { landingGuard, roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage),
  },

    // Feature 2: request details. Outside the tabs, so it has its own back button.
  {
    path: 'request/:id',
    canActivate: [roleGuard('faculty')],
    loadComponent: () => import('./pages/request-details.page').then((m) => m.RequestDetailsPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard], // must be logged in
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },

      // Step 9: real faculty home (welcome text and two shortcuts, no data loaded).
      {
        path: 'faculty-home',
        canActivate: [roleGuard('faculty')],
        loadComponent: () => import('./pages/faculty-home.page').then((m) => m.FacultyHomePage),
      },
      {
        path: 'new-report',
        canActivate: [roleGuard('faculty')],
        loadComponent: () => import('./pages/new-report.page').then((m) => m.NewReportPage),
      },
      {
        path: 'my-reports',
        canActivate: [roleGuard('faculty')],
        loadComponent: () => import('./pages/my-reports.page').then((m) => m.MyReportsPage),
      },

      // Step 8: read-only list of all requests. The path stays 'dashboard' so ROLE_HOME does not change.
      {
        path: 'dashboard',
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./pages/all-requests.page').then((m) => m.AllRequestsPage),
      },
      {
        path: 'manage-reports',
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./pages/manage-reports.page').then((m) => m.ManageReportsPage),
      },

      // Daily report (admin only, read-only record). Named daily-report so it does not clash with manage-reports.
      {
        path: 'daily-report',
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./pages/daily-report.page').then((m) => m.DailyReportPage),
      },
      // Step 9: the Control tab is removed (no route for it any more).

      // Step 5: the real staff job screen.
      {
        path: 'assigned',
        canActivate: [roleGuard('staff')],
        loadComponent: () => import('./pages/assigned-job.page').then((m) => m.AssignedJobPage),
      },

      // Step 7: reviews about the logged-in staff member.
      {
        path: 'reviews',
        canActivate: [roleGuard('staff')],
        loadComponent: () => import('./pages/staff-reviews.page').then((m) => m.StaffReviewsPage),
      },

      { path: 'account', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
    ],
  },

  { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },
  { path: '**', redirectTo: '' },
];