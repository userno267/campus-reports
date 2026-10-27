import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { NewReportInput } from '../models/report.model';

// Business rules for reports. Pages call this; this calls DatabaseService.
// Later features (XP, status changes) will be added here.
@Injectable({ providedIn: 'root' })
export class ReportService {
  private db = inject(DatabaseService);
  private auth = inject(AuthService);

  // Validates, cleans up the input, and saves. Throws an Error with a
  // friendly message if something is wrong (the page shows it in a toast).
  async submit(input: NewReportInput): Promise<number> {
    const user = this.auth.user();
    if (!user) throw new Error('Please log in again.');

    const title = input.title.trim();
    const description = (input.description ?? '').trim();

    if (title.length < 3) throw new Error('Please enter a title (at least 3 characters).');
    if (!input.category_id) throw new Error('Please choose a category.');

    return this.db.createReport(
      {
        title,
        category_id: input.category_id,
        description: description === '' ? null : description, // empty -> NULL in the DB
      },
      user.id
    );
    
  }
  
  // Admin: get all reports, optionally filtered by status.
  async getAllReports(status: string | null = null): Promise<any[]> {
    return this.db.getAllReports(status);
  }

  // Admin: update a report's category, priority, or routed_to.
  async updateReport(id: number, updates: any): Promise<void> {
    return this.db.updateReport(id, updates);
  }

  // Get personnel for routing dropdown.
  async getPersonnel(): Promise<any[]> {
    return this.db.getPersonnel();
  }
}