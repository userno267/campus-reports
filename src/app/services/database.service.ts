import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Category, NewReportInput } from '../models/report.model';
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
    console.log('[DB] Initializing database...');
    if (this.isWeb) {
      console.log('[DB] Platform is web, initializing web store...');
      await this.sqlite.initWebStore();
    }

    // For web: check if we need to load from IndexedDB
    let dbExists = false;
    if (this.isWeb) {
      try {
        const result = await this.sqlite.checkConnectionsConsistency();
        dbExists = result.result ?? false;
        console.log('[DB] checkConnectionsConsistency result:', dbExists);
      } catch (e) {
        console.log('[DB] Error checking consistency:', e);
      }
    }

    // If database doesn't exist in memory but might be in IndexedDB, 
    // we still need to create/open it fresh (jeep-sqlite will load from store if it exists)
    console.log('[DB] Creating/opening connection to:', DB_NAME);
    this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

    await this.db.open();
    console.log('[DB] Database opened');
    await this.db.execute(SCHEMA);
    console.log('[DB] Schema executed');
    await this.seed();
    console.log('[DB] Seeding complete');
    await this.persist();
    console.log('[DB] Database ready!');
  }
  // On the web, SQLite lives in memory until it is saved to IndexedDB.
  // Forgetting this = data disappears on page refresh.
    private async persist(): Promise<void> {
    if (this.isWeb) {
      try {
        console.log('[DB] [PERSIST] Saving database to IndexedDB store...');
        await this.sqlite.saveToStore(DB_NAME);
        console.log('[DB] [PERSIST] Successfully saved to IndexedDB');
      } catch (e) {
        console.error('[DB] [PERSIST] ERROR saving to IndexedDB:', e);
      }
    }
  }

  // Seed categories and demo users (only if the tables are empty).
  private async seed(): Promise<void> {
    console.log('[DB] Seeding categories...');
    for (const name of ['Facilities', 'IT', 'Classroom', 'Administrative']) {
      await this.db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name]);
    }
    console.log('[DB] Categories seeded');

    const count = await this.db.query('SELECT COUNT(*) AS n FROM users');
    console.log('[DB] User count:', count.values?.[0]?.n);
    if (count.values && count.values[0].n > 0) {
      console.log('[DB] Users already exist, skipping user seed');
      return;
    }

    console.log('[DB] Seeding demo users...');
    const demoUsers: { name: string; email: string; role: Role }[] = [
      { name: 'Ana Reyes (Admin)', email: 'admin@campus.edu', role: 'admin' },
      { name: 'Prof. Ben Cruz', email: 'ben@campus.edu', role: 'faculty' },
      { name: 'Prof. Carla Santos', email: 'carla@campus.edu', role: 'faculty' },
      { name: 'Dan Villanueva (Maintenance)', email: 'dan@campus.edu', role: 'staff' },
      { name: 'Ella Garcia (IT Support)', email: 'ella@campus.edu', role: 'staff' },
    ];

    for (const u of demoUsers) {
      const hash = await hashPassword(u.email, 'demo1234');
      await this.db.run(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [u.name, u.email, hash, u.role]
      );
    }
    console.log('[DB] Demo users seeded');
  }

  // ---------- Small helpers ----------

  private async all<T>(sql: string, values: any[] = []): Promise<T[]> {
    try {
      const result = await this.db.query(sql, values);
      console.log('[DB] Query executed:', sql.substring(0, 100) + '...', 'Rows returned:', result.values?.length ?? 0);
      return (result.values ?? []) as T[];
    } catch (e: any) {
      console.error('[DB] Query error:', sql, 'Error:', e);
      throw e;
    }
  }

  private async run(sql: string, values: any[] = []) {
    try {
      const result = await this.db.run(sql, values);
      console.log('[DB] Executed:', sql.substring(0, 100) + '...', 'Changes:', result.changes?.changes);
      await this.persist();
      console.log('[DB] Persisted');
      return result;
    } catch (e: any) {
      console.error('[DB] Execute error:', sql, 'Error:', e);
      throw e;
    }
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

  // ---------- Reports ----------

  // Inserts the report AND its first status_history row ("submitted").
  // Returns the new report's id.
  async createReport(input: NewReportInput, userId: number): Promise<number> {
    await this.ready;
    const now = new Date().toISOString(); // UTC ISO string

    console.log('[DB] createReport called:', { title: input.title, category_id: input.category_id, userId });

    const result = await this.run(
      'INSERT INTO reports (title, category_id, description, status, created_by, created_at) VALUES (?, ?, ?, \'submitted\', ?, ?)',
      [input.title, input.category_id, input.description, userId, now]
    );
    const reportId = result.changes?.lastId as number;

    console.log('[DB] Report inserted with ID:', reportId);

    await this.run(
      'INSERT INTO status_history (report_id, status, remark, changed_by, changed_at) VALUES (?, \'submitted\', NULL, ?, ?)',
      [reportId, userId, now]
    );

    console.log('[DB] Status history inserted for report', reportId);
    return reportId;
  }

  // Get all reports (for admin), optionally filtered by status.
  // Returns: {id, title, status, priority, created_at, category_name}
  async getAllReports(status: string | null = null): Promise<any[]> {
    await this.ready;
    let sql = 'SELECT r.id, r.title, r.status, r.priority, r.created_at, c.name AS category_name FROM reports r LEFT JOIN categories c ON r.category_id = c.id';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';
    console.log('[DB] getAllReports called with status:', status);
    const result = await this.all<any>(sql, params);
    console.log('[DB] getAllReports returning', result.length, 'reports');
    return result;
  }

  // Get a single report with names joined in (for viewing/editing).
  async getReportById(id: number): Promise<any | null> {
    await this.ready;
    const sql = 'SELECT r.*, c.name AS category_name, u_created.name AS created_by_name, u_routed.name AS routed_to_name FROM reports r LEFT JOIN categories c ON r.category_id = c.id LEFT JOIN users u_created ON r.created_by = u_created.id LEFT JOIN users u_routed ON r.routed_to = u_routed.id WHERE r.id = ?';
    console.log('[DB] getReportById called for id:', id);
    const rows = await this.all<any>(sql, [id]);
    console.log('[DB] getReportById found:', rows.length > 0 ? 'yes' : 'no');
    return rows[0] ?? null;
  }

  // Update report fields (admin editing). Only updates the fields passed in.
  async updateReport(id: number, updates: any): Promise<void> {
    await this.ready;
    const fields: string[] = [];
    const values: any[] = [];

    if ('category_id' in updates) {
      fields.push('category_id = ?');
      values.push(updates.category_id);
    }
    if ('priority' in updates) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if ('routed_to' in updates) {
      fields.push('routed_to = ?');
      values.push(updates.routed_to);
    }

    if (fields.length === 0) {
      console.log('[DB] updateReport: no fields to update');
      return;
    }

    values.push(id);
    console.log('[DB] updateReport called for id:', id, 'updates:', updates);
    await this.run(
      `UPDATE reports SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    console.log('[DB] updateReport complete');
  }

  // Get all personnel (role = 'personnel') for the routing dropdown.
  async getPersonnel(): Promise<User[]> {
    await this.ready;
    console.log('[DB] getPersonnel called');
    const result = await this.all<User>(
      'SELECT id, name, email, role, xp FROM users WHERE role = ? ORDER BY name',
      ['personnel']
    );
    console.log('[DB] getPersonnel returning', result.length, 'personnel');
    return result;
  }

  // Get reports for a specific user (faculty), optionally filtered by status.
  // Returns: {id, title, status, priority, created_at, category_name}
  async getReportsByUser(userId: number, status: string | null = null): Promise<any[]> {
    await this.ready;
    let sql = 'SELECT r.id, r.title, r.status, r.priority, r.created_at, c.name AS category_name FROM reports r LEFT JOIN categories c ON r.category_id = c.id WHERE r.created_by = ?';
    const params: any[] = [userId];

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';
    console.log('[DB] getReportsByUser called for userId:', userId, 'status:', status);
    const result = await this.all<any>(sql, params);
    console.log('[DB] getReportsByUser returning', result.length, 'reports');
    return result;
  }
}