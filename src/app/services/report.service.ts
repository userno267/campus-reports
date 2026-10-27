import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NewReportInput } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  async submit(input: NewReportInput): Promise<number> {
    const user = this.auth.user();
    if (!user) throw new Error('Please log in again.');

    const title = input.title.trim();
    const description = (input.description ?? '').trim();

    if (title.length < 3) throw new Error('Please enter a title (at least 3 characters).');
    if (!input.category_id) throw new Error('Please choose a category.');

    return this.api.createReport(
      title,
      input.category_id,
      description === '' ? null : description,
      user.id
    );
  }

  async getAllReports(status: string | null = null): Promise<any[]> {
    return this.api.getAllReports(status);
  }

  async getMyReports(status: string | null = null): Promise<any[]> {
    const user = this.auth.user();
    if (!user) throw new Error('Please log in again.');
    return this.api.getUserReports(user.id, status);
  }

  async updateReport(id: number, updates: any): Promise<void> {
    return this.api.updateReport(id, updates);
  }

  async getPersonnel(): Promise<any[]> {
    return this.api.getPersonnel();
  }

  async getCategories(): Promise<any[]> {
    return this.api.getCategories();
  }
}