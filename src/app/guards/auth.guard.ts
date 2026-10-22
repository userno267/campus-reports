import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Blocks pages unless someone is logged in. (Role guards come in Stage 3.)
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready; // wait until the saved session has been restored
  return auth.user() ? true : router.createUrlTree(['/login']);
};