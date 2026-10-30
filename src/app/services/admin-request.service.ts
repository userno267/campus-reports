import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { AdminRequestDetail, AdminRequestRow, StaffMember } from '../models/request.model';
import { Department } from '../models/user.model';

// What the manage page passes in. Nullable because the form starts empty.
export interface AssignInput {
  request_id: number;
  department_id: number | null;
  staff_id: number | null;
  remark: string;
}

// Admin-only wrapper. Pages call this, this calls ApiService.
// The checks here give quick feedback only. The server checks the role and every rule again.
@Injectable({ providedIn: 'root' })
export class AdminRequestService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  private requireAdmin(): void {
    if (this.auth.user()?.role !== 'admin') {
      throw new Error('Only admins can do this.');
    }
  }

  async loadQueue(): Promise<AdminRequestRow[]> {
    this.requireAdmin();
    return this.api.getAdminQueue();
  }

  async loadDetail(id: number): Promise<AdminRequestDetail> {
    this.requireAdmin();
    return this.api.getAdminRequest(id);
  }

  getDepartments(): Promise<Department[]> {
    return this.api.getDepartments();
  }

  async getStaff(departmentId: number | null = null): Promise<StaffMember[]> {
    this.requireAdmin();
    return this.api.getStaff(departmentId);
  }

  async assign(input: AssignInput): Promise<void> {
    this.requireAdmin();
    if (input.department_id === null) throw new Error('Please choose a department.');
    if (input.staff_id === null) throw new Error('Please choose a staff member.');

    await this.api.assignRequest({
      request_id: input.request_id,
      department_id: input.department_id,
      staff_id: input.staff_id,
      remark: input.remark,
    });
  }

  async cancel(requestId: number, remark: string = ''): Promise<void> {
    this.requireAdmin();
    await this.api.cancelRequest({ request_id: requestId, remark });
  }
}