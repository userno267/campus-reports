import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ProofCapture, StaffJob, StaffReviewList } from '../models/request.model';

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
  // capture is where and when the proof photo was taken. Both are required (C2).
  async submitProof(
    requestId: number,
    photo: string | null,
    note: string,
    capture: ProofCapture
  ): Promise<StaffJob> {
    this.requireStaff();
    if (!photo) {
      throw new Error('Please take a photo of the finished work.');
    }
    if (capture.latitude === null || capture.longitude === null) {
      throw new Error('Your location is needed to send proof. Tap Try GPS again.');
    }
    if (capture.takenAt === null) {
      throw new Error('The photo time is missing. Please take the photo again.');
    }
    const trimmed = note.trim();
    return this.api.submitProof({
      request_id: requestId,
      after_photo: photo,
      proof_note: trimmed === '' ? null : trimmed,
      after_latitude: capture.latitude,
      after_longitude: capture.longitude,
      after_photo_taken_at: capture.takenAt,
    });
  }

  // Step 7: reviews faculty left about this staff member's finished jobs.
  async loadReviews(): Promise<StaffReviewList> {
    this.requireStaff();
    return this.api.getStaffReviews();
  }
}