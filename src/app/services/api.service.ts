import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_BASE = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ===== AUTH =====
  async login(email: string, password: string): Promise<any> {
    try {
      const response = await this.http
        .post(`${API_BASE}/auth.php?action=login`, { email, password })
        .toPromise();
      return response;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Login failed');
    }
  }

  async register(name: string, email: string, password: string): Promise<any> {
    try {
      const response = await this.http
        .post(`${API_BASE}/auth.php?action=register`, { name, email, password })
        .toPromise();
      return response;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Registration failed');
    }
  }

  // ===== REPORTS =====
  async getAllReports(status: string | null = null): Promise<any> {
    try {
      let url = `${API_BASE}/reports.php?action=all`;
      if (status) url += `&status=${status}`;
      const response: any = await this.http.get(url).toPromise();
      return response.reports ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load reports');
    }
  }

  async getUserReports(userId: number, status: string | null = null): Promise<any> {
    try {
      let url = `${API_BASE}/reports.php?action=user&user_id=${userId}`;
      if (status) url += `&status=${status}`;
      const response: any = await this.http.get(url).toPromise();
      return response.reports ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load reports');
    }
  }

  async createReport(title: string, categoryId: number | null, description: string | null, userId: number): Promise<any> {
    try {
      const response: any = await this.http
        .post(`${API_BASE}/reports.php?action=create`, {
          title,
          category_id: categoryId,
          description,
          user_id: userId,
        })
        .toPromise();
      return response.id;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to create report');
    }
  }

  async updateReport(reportId: number, updates: any): Promise<any> {
    try {
      const response = await this.http
        .put(`${API_BASE}/reports.php?action=update`, {
          id: reportId,
          ...updates,
        })
        .toPromise();
      return response;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to update report');
    }
  }

  // ===== CATEGORIES =====
  async getCategories(): Promise<any> {
    try {
      const response: any = await this.http.get(`${API_BASE}/categories.php`).toPromise();
      return response.categories ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load categories');
    }
  }

  // ===== PERSONNEL =====
  async getPersonnel(): Promise<any> {
    try {
      const response: any = await this.http.get(`${API_BASE}/personnel.php`).toPromise();
      return response.personnel ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load personnel');
    }
  }
}