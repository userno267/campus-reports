import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Department, RegisterInput, User } from '../models/user.model';
import { DailyReport } from '../models/daily-report.model';
import {
  AdminRequestDetail,
  AdminRequestRow,
  AssignRequestPayload,
  CampusLocation,
  CancelRequestPayload,
  CreateRequestPayload,
  FacultyRequestDetail,
    CreateReviewPayload,
  RequestStatus,
  RequestSummary,
  StaffJob,
  StaffMember,
  StaffReviewList,
  SubmitProofPayload,
} from '../models/request.model';

// What a screen asks changes.php about (live updates). The server checks the role.
export type ChangeTarget = 'list' | 'request' | 'job' | 'reviews';

// Exported so the interceptor can tell our API apart from other websites.
export const API_BASE = environment.apiBase;

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
  // Feature 2: one of my own requests, with photos, timeline and rating. The server checks the owner.
  async getMyRequestDetail(id: number): Promise<FacultyRequestDetail> {
    try {
      const response: any = await firstValueFrom(
        this.http.get(`${API_BASE}/reports.php?action=my_detail&id=${id}`)
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load the request');
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

  // Step 8: every request in any status, read-only. Pass a status to filter, or null for all.
  async getAllRequests(status: RequestStatus | null = null): Promise<AdminRequestRow[]> {
    try {
      const url = status
        ? `${API_BASE}/reports.php?action=all&status=${encodeURIComponent(status)}`
        : `${API_BASE}/reports.php?action=all`;
      const response: any = await firstValueFrom(this.http.get(url));
      return response.requests ?? [];
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load the requests');
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
  // Admin sends the proof back to the staff member. The reason is required.
  async rejectProof(requestId: number, remark: string): Promise<AdminRequestRow> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/reports.php?action=reject_proof`, { request_id: requestId, remark })
      );
      return response.request;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not send the proof back');
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

  // ===== DAILY REPORT (admin only, read-only) =====
  // date is YYYY-MM-DD in Philippine time. Pass null for today (Philippine time) on the server.
  async getDailyReport(date: string | null = null): Promise<DailyReport> {
    try {
      const url = date
        ? `${API_BASE}/daily_report.php?date=${encodeURIComponent(date)}`
        : `${API_BASE}/daily_report.php`;
      const response: any = await firstValueFrom(this.http.get(url));
      return response as DailyReport;
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not load the daily report');
    }
  }
  // Faculty (or admin) adds a location that is not in the list yet.
  // The server returns the existing one if the name already exists (ignoring case).
  async createLocation(name: string): Promise<{ location: CampusLocation; created: boolean }> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${API_BASE}/locations.php?action=create`, { name })
      );
      return { location: response.location, created: !!response.created };
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Could not add the location');
    }
  }
  // ===== LIVE UPDATES =====
  // A tiny token that changes whenever the data behind a screen changes. No data, no photos.
  // Keeps the raw error on purpose: the polling helper ignores errors and tries again later.
  async checkChanges(target: ChangeTarget, id: number | null = null): Promise<string> {
    const idPart = id !== null ? `&id=${id}` : '';
    const response: any = await firstValueFrom(
      this.http.get(`${API_BASE}/changes.php?action=check&target=${target}${idPart}`)
    );
    return String(response.token);
  }

  // ===== STAFF REVIEWS (Step 7) =====
  // Staff only. The server returns only the reviews about the logged-in staff member.
  async getStaffReviews(): Promise<StaffReviewList> {
    try {
      const response: any = await firstValueFrom(this.http.get(`${API_BASE}/reviews.php?action=for_staff`));
      return {
        reviews: response.reviews ?? [],
        summary: response.summary ?? { count: 0, average: null },
      };
    } catch (e: any) {
      throw new Error(e.error?.error ?? 'Failed to load your reviews');
    }
  }
}