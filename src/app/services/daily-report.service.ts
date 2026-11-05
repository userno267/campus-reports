import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { DailyReport } from '../models/daily-report.model';

// Admin-only wrapper, same pattern as AdminRequestService.
// The check here gives quick feedback only. The server checks the role again on every call.
@Injectable({ providedIn: 'root' })
export class DailyReportService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  private requireAdmin(): void {
    if (this.auth.user()?.role !== 'admin') {
      throw new Error('Only admins can do this.');
    }
  }

  // date is YYYY-MM-DD (Philippine time). Null means today.
  async load(date: string | null = null): Promise<DailyReport> {
    this.requireAdmin();
    return this.api.getDailyReport(date);
  }
}