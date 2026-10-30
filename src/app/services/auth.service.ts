import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Department, RegisterInput, Role, User } from '../models/user.model';

// localStorage keys. The interceptor reads SESSION_KEY to build the X-User-Id header.
export const SESSION_KEY = 'campus_user_id';
const USER_KEY = 'campus_user';

const VALID_ROLES: Role[] = ['faculty', 'admin', 'staff'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  user = signal<User | null>(null);
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restoreSession();
  }

  // Restore the saved login, then ask the server "is this user still real?".
  // This also clears old sessions left over from the previous design (role 'personnel')
  // and sessions whose user vanished after "docker compose down -v".
  private async restoreSession(): Promise<void> {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return;

    let user: User | null = null;
    try {
      user = JSON.parse(saved);
    } catch {
      /* corrupt JSON: treated as no session below */
    }
    if (!user || !VALID_ROLES.includes(user.role)) {
      this.clearSession();
      return;
    }

    this.user.set(user); // show the app right away
    localStorage.setItem(SESSION_KEY, String(user.id)); // the interceptor reads this
    try {
      this.startSession(await this.api.getCurrentUser()); // refresh from the server
    } catch (e: any) {
      // 401 = user no longer exists. Any other error (server offline) keeps the saved login.
      if (e.status === 401) this.clearSession();
    }
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.api.login(email, password);
    this.startSession(user);
    return user;
  }

  // Validates in the browser for fast feedback. The server validates again (never trust the client).
  async register(input: RegisterInput): Promise<User> {
    if (input.name.trim().length < 2) throw new Error('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new Error('Please enter a valid email.');
    if (input.employee_id.trim() === '') throw new Error('Please enter your employee ID.');
    if (input.password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (input.role === 'staff' && !input.department_id) throw new Error('Please choose your department.');

    const user = await this.api.register({
      ...input,
      name: input.name.trim(),
      email: input.email.trim(),
      employee_id: input.employee_id.trim(),
      department_id: input.role === 'staff' ? input.department_id : null,
    });
    this.startSession(user); // the API returns the new user, so no second login call
    return user;
  }

  // For the register form's department dropdown.
  getDepartments(): Promise<Department[]> {
    return this.api.getDepartments();
  }

  logout(): void {
    this.clearSession();
  }

  private startSession(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_KEY, String(user.id));
    this.user.set(user);
  }

  private clearSession(): void {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
  }
}