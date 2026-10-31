import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import {
  CampusLocation,
  CreateRequestPayload,
  CreateReviewPayload,
  RequestCategory,
  RequestSummary,
} from '../models/request.model';

// What the New Report form gives us. Nullable because the form starts empty.
export interface NewRequestForm {
  title: string;
  category_id: number | null;
  location_id: number | null;
  description: string;
  before_photo: string | null;   // raw base64 from photo.util.ts
}

// Pages never call HTTP directly. They call this service, which calls ApiService.
@Injectable({ providedIn: 'root' })
export class RequestService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  getLocations(): Promise<CampusLocation[]> {
    return this.api.getLocations();
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
    if (form.category_id === null) throw new Error('Please choose a category.');
    if (form.location_id === null) throw new Error('Please choose a location.');
    if (description === '') throw new Error('Please describe the problem.');
    if (!form.before_photo) throw new Error('Please add a before photo.');

    const payload: CreateRequestPayload = {
      title,
      category_id: form.category_id,
      location_id: form.location_id,
      description,
      before_photo: form.before_photo,
    };

    const created = await this.api.createRequest(payload);
    return created.id;
  }

  async getMyRequests(): Promise<RequestSummary[]> {
    if (!this.auth.user()) throw new Error('Please log in again.');
    return this.api.getMyRequests();
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