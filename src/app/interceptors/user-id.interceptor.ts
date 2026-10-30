import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE } from '../services/api.service';
import { SESSION_KEY } from '../services/auth.service';

// Adds the X-User-Id header to every request that goes to our own API.
// The backend reads this header in requireUser() to know who is asking.
// NOTE: a real system would send a signed token (JWT) instead. Fine for a school demo.
//
// It reads localStorage directly (not AuthService) on purpose: AuthService uses
// HttpClient, and HttpClient uses this interceptor, so injecting AuthService here
// would create a circular dependency.
export const userIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) {
    return next(req); // never leak the header to other websites
  }

  let userId: string | null = null;
  try {
    userId = localStorage.getItem(SESSION_KEY);
  } catch {
    // storage blocked: send the request without the header
  }

  return userId ? next(req.clone({ setHeaders: { 'X-User-Id': userId } })) : next(req);
};