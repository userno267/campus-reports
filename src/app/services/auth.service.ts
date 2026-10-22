import { Injectable, inject, signal } from '@angular/core';
import { DatabaseService } from './database.service';
import { User } from '../models/user.model';
import { hashPassword } from '../utils/hash';

const SESSION_KEY = 'campus_user_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private db = inject(DatabaseService);

  // A signal holds the logged-in user; pages read it with auth.user()
  user = signal<User | null>(null);

  // Guards wait for this so a page refresh doesn't log you out
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    const id = Number(localStorage.getItem(SESSION_KEY));
    if (id) {
      this.user.set(await this.db.getUserById(id));
    }
  }

  async login(email: string, password: string): Promise<User> {
    const row = await this.db.getUserRowByEmail(email);
    const hash = await hashPassword(email, password);

    // Same message for both cases so we don't reveal which emails exist
    if (!row || row.password_hash !== hash) {
      throw new Error('Invalid email or password.');
    }

    const user = await this.db.getUserById(row.id);
    this.startSession(user!);
    return user!;
  }

  // Registration always creates a FACULTY account.
  async register(name: string, email: string, password: string): Promise<User> {
    if (name.trim().length < 2) throw new Error('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    if (await this.db.getUserRowByEmail(email)) {
      throw new Error('That email is already registered.');
    }

    const hash = await hashPassword(email, password);
    const id = await this.db.createUser(name, email, hash, 'faculty');
    const user = (await this.db.getUserById(id))!;
    this.startSession(user);
    return user;
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
  }

  private startSession(user: User): void {
    localStorage.setItem(SESSION_KEY, String(user.id));
    this.user.set(user);
  }
}