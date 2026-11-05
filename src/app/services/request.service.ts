import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import {
  CampusLocation,
  CreateRequestPayload,
  CreateReviewPayload,
  FacultyRequestDetail,
  RequestCategory,
  RequestSummary,
} from '../models/request.model';

// What the New Report form gives us. Nullable because the form starts empty.
// Feature 4: the GPS fix and photo time are null when the device could not provide them.
export interface NewRequestForm {
  title: string;
  category_id: number | null;
  location_id: number | null;
  description: string;
  before_photo: string | null;   // raw base64 from photo.util.ts
  latitude: number | null;
  longitude: number | null;
  photo_taken_at: string | null; // ISO string (UTC) or null
}

// Pages never call HTTP directly. They call this service, which calls ApiService.
@Injectable({ providedIn: 'root' })
export class RequestService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  getLocations(): Promise<CampusLocation[]> {
    return this.api.getLocations();
  }

  // Adds a location the faculty member could not find. Returns the existing one if the name is already in use.
  async createLocation(name: string): Promise<{ location: CampusLocation; created: boolean }> {
    if (!this.auth.user()) throw new Error('Please log in again.');
    const trimmed = name.trim();
    if (trimmed === '') throw new Error('Please type a location name.');
    return this.api.createLocation(trimmed);
  }

  async getCategories(): Promise<RequestCategory[]> {
    return (await this.api.getCategories()) as RequestCategory[];
  }

  // Checks the form in the browser for quick feedback. The server checks again.
  async submit(form: NewRequestForm): Promise<number> {
    if (!this.auth.user()) throw new Error('Please log in again.');

    const title = form.title.trim();
    const description = form.description.trim();

    if (title.length < 3) throw new Error('Please enter a title (at least 3 characters).');
    if (form.category_id === null) throw new Error('Please choose a category from the list.');
    if (form.location_id === null) throw new Error('Please choose a location from the list.');
    if (description === '') throw new Error('Please describe the problem.');
    if (!form.before_photo) throw new Error('Please add a before photo.');

    // Coordinates go together. If only one is set, send neither (the server would refuse a half pair).
    const hasLocation = form.latitude !== null && form.longitude !== null;

    const payload: CreateRequestPayload = {
      title,
      category_id: form.category_id,
      location_id: form.location_id,
      description,
      before_photo: form.before_photo,
      latitude: hasLocation ? form.latitude : null,
      longitude: hasLocation ? form.longitude : null,
      photo_taken_at: form.photo_taken_at,
    };

    const created = await this.api.createRequest(payload);
    return created.id;
  }

  async getMyRequests(): Promise<RequestSummary[]> {
    if (!this.auth.user()) throw new Error('Please log in again.');
    return this.api.getMyRequests();
  }

  // Feature 2: one of my own requests, with photos, timeline and rating.
  async getMyRequestDetail(id: number): Promise<FacultyRequestDetail> {
    if (!this.auth.user()) throw new Error('Please log in again.');
    return this.api.getMyRequestDetail(id);
  }

  // Step 6: rate the staff member after the request is completed. Reviews are final.
  // Checks here give quick feedback only. The server checks again.
  async submitReview(requestId: number, rating: number | null, comment: string): Promise<void> {
    if (!this.auth.user()) throw new Error('Please log in again.');
    if (rating === null || rating < 1 || rating > 5) throw new Error('Please choose a rating from 1 to 5.');

    const trimmed = comment.trim();
    if (trimmed.length > 300) throw new Error('Comment must be 300 characters or less.');

    const payload: CreateReviewPayload = {
      request_id: requestId,
      rating,
      comment: trimmed === '' ? null : trimmed,
    };
    await this.api.createReview(payload);
  }
}