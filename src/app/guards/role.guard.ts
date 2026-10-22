import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/user.model';

// Where each role lands after login.
export const ROLE_HOME: Record<Role, string> = {
  faculty: '/tabs/faculty-home',
  admin: '/tabs/dashboard',
  personnel: '/tabs/assigned',
};

// Usage in routes: canActivate: [roleGuard('admin')]
// Lets only the listed roles in; everyone else is sent to their own home.
export const roleGuard = (...allowed: Role[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.ready; // wait for the saved session to be restored
    const user = auth.user();

    if (!user) return router.createUrlTree(['/login']);
    return allowed.includes(user.role) ? true : router.createUrlTree([ROLE_HOME[user.role]]);
  };
};

// Used on the empty path: sends each role to its own landing tab.
export const landingGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  const user = auth.user();
  return router.createUrlTree([user ? ROLE_HOME[user.role] : '/login']);
};