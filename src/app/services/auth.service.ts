import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { User } from '../models/user.model';

const SESSION_KEY = 'campus_user_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  user = signal<User | null>(null);
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    const storedUser = localStorage.getItem('campus_user');
    if (storedUser) {
      try {
        this.user.set(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('campus_user');
      }
    }
  }

  async login(email: string, password: string): Promise<User> {
    const response: any = await this.api.login(email, password);
    const user = response.user;
    this.startSession(user);
    return user;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    if (name.trim().length < 2) throw new Error('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    await this.api.register(name, email, password);
    // After registration, auto-login
    return this.login(email, password);
  }

  logout(): void {
    localStorage.removeItem('campus_user');
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
  }

  private startSession(user: User): void {
    localStorage.setItem('campus_user', JSON.stringify(user));
    localStorage.setItem(SESSION_KEY, String(user.id));
    this.user.set(user);
  }
}