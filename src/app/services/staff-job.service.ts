import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { StaffJob } from '../models/request.model';

// Staff-only wrapper. Pages call this, this calls ApiService.
// The checks here give quick feedback. The server checks the role and the job owner again.
@Injectable({ providedIn: 'root' })
export class StaffJobService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  private requireStaff(): void {
    if (this.auth.user()?.role !== 'staff') {
      throw new Error('Only staff can do this.');
    }
  }

  async loadCurrent(): Promise<StaffJob | null> {
    this.requireStaff();
    return this.api.getCurrentJob();
  }

  async start(requestId: number): Promise<StaffJob> {
    this.requireStaff();
    return this.api.startJob(requestId);
  }

  // photo is the raw base64 from photo.util.ts. note is optional free text.
  async submitProof(requestId: number, photo: string | null, note: string): Promise<StaffJob> {
    this.requireStaff();
    if (!photo) {
      throw new Error('Please take a photo of the finished work.');
    }
    const trimmed = note.trim();
    return this.api.submitProof({
      request_id: requestId,
      after_photo: photo,
      proof_note: trimmed === '' ? null : trimmed,
    });
  }
}