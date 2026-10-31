import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Department, RegisterInput, User } from '../models/user.model';
import {
  AdminRequestDetail,
  AdminRequestRow,
  AssignRequestPayload,
  CampusLocation,
  CancelRequestPayload,
  CreateRequestPayload,
  CreateReviewPayload,
  RequestSummary,
  StaffJob,
  StaffMember,
  SubmitProofPayload,
} from '../models/request.model';

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

  // ===== ADMIN REQUESTS (Step 4) =====
  async getAdminQueue(): Promise<AdminRequestRow[]> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/reports.php?action=queue`));
      return response.requests ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load the request queue');
    }
  }

  async getAdminRequest(id: number): Promise<AdminRequestDetail> {
    try {
      const response: any = await firstValueFrom(
        this.http.get(`${API_BASE}/reports.php?action=detail&id=${id}`)
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load the request');
    }
  }

  async assignRequest(payload: AssignRequestPayload): Promise<AdminRequestRow> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/reports.php?action=assign`, payload)
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not assign the request');
    }
  }

  async cancelRequest(payload: CancelRequestPayload): Promise<AdminRequestRow> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/reports.php?action=cancel`, payload)
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not cancel the request');
    }
  }

  // Step 6: admin approves the proof. The server only allows this from awaiting_proof.
  async completeRequest(requestId: number, remark: string): Promise<AdminRequestRow> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/reports.php?action=complete`, { request_id: requestId, remark })
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not complete the request');
    }
  }

  // Staff list. Pass a department id to filter, or null for everyone.
  async getStaff(departmentId: number | null = null): Promise<StaffMember[]> {
    try {
      const url = departmentId
        ? `${API_BASE}/personnel.php?department_id=${departmentId}`
        : `${API_BASE}/personnel.php`;
      const response: any = await firstValueFrom(this.http.get(url));
      return response.personnel ?? [];
    } catch (e: any) {
          throw new Error(e.error?.error ?? 'Failed to load staff');
    }
  }

  // ===== STAFF JOBS (Step 5) =====
  // Returns the staff member's active job, or null when they have none.
  async getCurrentJob(): Promise<StaffJob | null> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/jobs.php?action=current`));
      return response.job ?? null;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load your job');
    }
  }

  async startJob(requestId: number): Promise<StaffJob> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/jobs.php?action=start`, { request_id: requestId })
      );
      return response.job;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not start the job');
    }
  }

  async submitProof(payload: SubmitProofPayload): Promise<StaffJob> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/jobs.php?action=proof`, payload)
      );
      return response.job;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not send the proof');
    }
  }

  // ===== REVIEWS (Step 6) =====
  // Faculty only. The server checks the owner, the status, and that it is the first review.
  async createReview(payload: CreateReviewPayload): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/reviews.php?action=create`, payload));
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not save your rating');
    }
  }
}