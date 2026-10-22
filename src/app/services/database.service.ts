import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Category } from '../models/report.model';
import { Role, User } from '../models/user.model';
import { hashPassword } from '../utils/hash';

const DB_NAME = 'campus_reports';

// All tables from the spec (plus email/password_hash and photo_taken_at).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  photo TEXT,
  photo_taken_at TEXT,
  latitude REAL,
  longitude REAL,
  location_text TEXT,
  weather_note TEXT,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  routed_to INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  status TEXT NOT NULL,
  remark TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  report_id INTEGER REFERENCES reports(id),
  action TEXT NOT NULL,
  xp INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  UNIQUE(user_id, badge_code)
);
`;

// Internal row type: includes the hash. Never exported to pages.
interface UserRow extends User {
  password_hash: string;
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;
  private isWeb = Capacitor.getPlatform() === 'web';

  // Every public method awaits this, so nothing touches the DB before it is open.
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  // ---------- Setup ----------

  private async init(): Promise<void> {
    if (this.isWeb) {
      await this.sqlite.initWebStore();
    }

    // Reuse the connection if it already exists (happens on hot reload)
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
    const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;

    if (consistent && exists) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    await this.db.open();
    await this.db.execute(SCHEMA);
    await this.seed();
    await this.persist();
  }

  // On the web, SQLite lives in memory until it is saved to IndexedDB.
  // Forgetting this = data disappears on page refresh.
  private async persist(): Promise<void> {
    if (this.isWeb) {
      await this.sqlite.saveToStore(DB_NAME);
    }
  }

  // Seed categories and demo users (only if the tables are empty).
  private async seed(): Promise<void> {
    for (const name of ['Facilities', 'IT', 'Classroom', 'Administrative']) {
      await this.db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name]);
    }

    const count = await this.db.query('SELECT COUNT(*) AS n FROM users');
    if (count.values && count.values[0].n > 0) return;

    const demoUsers: { name: string; email: string; role: Role }[] = [
      { name: 'Ana Reyes (Admin)', email: 'admin@campus.edu', role: 'admin' },
      { name: 'Prof. Ben Cruz', email: 'ben@campus.edu', role: 'faculty' },
      { name: 'Prof. Carla Santos', email: 'carla@campus.edu', role: 'faculty' },
      { name: 'Dan Villanueva (Maintenance)', email: 'dan@campus.edu', role: 'personnel' },
      { name: 'Ella Garcia (IT Support)', email: 'ella@campus.edu', role: 'personnel' },
    ];

    for (const u of demoUsers) {
      const hash = await hashPassword(u.email, 'demo1234');
      await this.db.run(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [u.name, u.email, hash, u.role]
      );
    }
  }

  // ---------- Small helpers ----------

  private async all<T>(sql: string, values: any[] = []): Promise<T[]> {
    const result = await this.db.query(sql, values);
    return (result.values ?? []) as T[];
  }

  private async run(sql: string, values: any[] = []) {
    const result = await this.db.run(sql, values);
    await this.persist();
    return result;
  }

  // ---------- Users ----------

  async getUserRowByEmail(email: string): Promise<UserRow | null> {
    await this.ready;
    const rows = await this.all<UserRow>(
      'SELECT id, name, email, password_hash, role, xp FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    return rows[0] ?? null;
  }

  async getUserById(id: number): Promise<User | null> {
    await this.ready;
    const rows = await this.all<User>(
      'SELECT id, name, email, role, xp FROM users WHERE id = ?',
      [id]
    );
    return rows[0] ?? null;
  }

  async createUser(name: string, email: string, passwordHash: string, role: Role): Promise<number> {
    await this.ready;
    const result = await this.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), passwordHash, role]
    );
    return result.changes?.lastId as number;
  }

  // ---------- Categories ----------

  async getCategories(): Promise<Category[]> {
    await this.ready;
    return this.all<Category>('SELECT id, name FROM categories ORDER BY id');
  }
}