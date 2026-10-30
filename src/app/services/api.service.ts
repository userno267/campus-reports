import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Department, RegisterInput, User } from '../models/user.model';
import { CampusLocation, CreateRequestPayload, RequestSummary } from '../models/request.model';
// Exported so the interceptor can tell our API apart from other websites.
export const API_BASE = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ===== AUTH =====
  async login(email: string, password: string): Promise<User> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/auth.php?action=login`, { email, password })
      );
      return response.user;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Login failed');
    }
  }

  async register(input: RegisterInput): Promise<User> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/auth.php?action=register`, input)
      );
      return response.user;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Registration failed');
    }
  }

  // Who does the server think I am? (X-User-Id is added by the interceptor.)
  // Keeps the raw error so AuthService can check e.status === 401.
  async getCurrentUser(): Promise<User> {
    const response: any = await firstValueFrom(this.http.get(`${API_BASE}/auth.php?action=me`));
    return response.user;
  }

  // ===== DEPARTMENTS =====
  async getDepartments(): Promise<Department[]> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/departments.php`));
      return response.departments ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load departments');
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
  // ===== LOCATIONS =====
  // Any logged-in user may call this. X-User-Id is added by the interceptor.
  async getLocations(): Promise<CampusLocation[]> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/locations.php`));
      return response.locations ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load locations');
    }
  }

  // ===== FACULTY REQUESTS (Step 3) =====
  // The server takes the user from X-User-Id, so no user id is sent in the body.
  async createRequest(payload: CreateRequestPayload): Promise<{ id: number; status: string }> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/reports.php?action=create`, payload)
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to submit the request');
    }
  }

  async getMyRequests(): Promise<RequestSummary[]> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/reports.php?action=mine`));
      return response.requests ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load your requests');
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