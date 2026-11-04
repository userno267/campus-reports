import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButtons, IonContent, IonHeader, IonItem,
  IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { FacultyRequestDetail, RequestStatus } from '../models/request.model';
import { RequestService } from '../services/request.service';
import { FeedbackService } from '../services/feedback.service';
import { RequestPhotoComponent } from '../components/request-photo.component';
import { PriorityBadgeComponent } from '../components/priority-badge.component';

// Same labels and colours as My Reports.
const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  assigned: 'Assigned',
  in_progress: 'In progress',
  awaiting_proof: 'Awaiting proof',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  submitted: 'medium',
  assigned: 'primary',
  in_progress: 'primary',
  awaiting_proof: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

// Faculty detail view for one of their own requests (Feature 2).
// Read-only: nothing here changes data. Rating stays in My Reports.
@Component({
  selector: 'app-request-details',
  standalone: true,
  imports: [
    DatePipe,
    IonBackButton, IonBadge, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonTitle, IonToolbar,
    RequestPhotoComponent,
    PriorityBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/my-reports" text="Back"></ion-back-button>
        </ion-buttons>
        <ion-title>Request details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (detail; as r) {
        <!-- The request itself -->
        <div class="card">
          <div class="head">
            <h2 class="title">{{ r.title }}</h2>
            <div class="badges">
              <app-priority-badge [priority]="r.priority" />
              <ion-badge [color]="statusColor(r.status)">{{ statusLabel(r.status) }}</ion-badge>
            </div>
          </div>
          <p class="meta">
            {{ r.category_name }} · {{ r.location_name }} · Reported {{ r.created_at | date: 'mediumDate' }}
          </p>
          <p class="text">{{ r.description }}</p>
          @if (r.staff_name) {
            <p class="meta">Done by {{ r.staff_name }}</p>
          }
        </div>

        <!-- The photo taken when the problem was reported -->
        <div class="card">
          <h3 class="section">Problem photo</h3>
          <app-request-photo [base64]="r.before_photo" alt="Problem photo" />
          <p class="meta">
            <strong>Taken at:</strong> {{ r.photo_taken_at ? (r.photo_taken_at | date: 'medium') : 'Time not recorded' }}
          </p>
          <p class="meta">
            <strong>Location:</strong> {{ formatCoords(r.latitude, r.longitude) }}
          </p>
        </div>

        <!-- Proof from staff, once they have sent it -->
        @if (r.after_photo; as afterPhoto) {
          <div class="card">
            <h3 class="section">Proof of completed work</h3>
            <app-request-photo [base64]="afterPhoto" alt="Proof photo" />
            <p class="meta">
              <strong>Taken at:</strong> {{ r.after_photo_taken_at ? (r.after_photo_taken_at | date: 'medium') : 'Time not recorded' }}
            </p>
            <p class="meta">
              <strong>Location:</strong> {{ formatCoords(r.after_latitude, r.after_longitude) }}
            </p>
            @if (r.proof_note) {
              <p class="text"><strong>Staff note:</strong> {{ r.proof_note }}</p>
            }
          </div>
        }

        <!-- Your rating, or a reminder that you can still rate it -->
        @if (r.review; as review) {
          <div class="card">
            <h3 class="section">Your rating</h3>
            <p class="rating">{{ review.rating }} / 5</p>
            @if (review.comment) {
              <p class="text">{{ review.comment }}</p>
            } @else {
              <p class="meta">No comment.</p>
            }
            <p class="meta">Rated {{ review.created_at | date: 'mediumDate' }}</p>
          </div>
        } @else if (r.status === 'completed') {
          <div class="card">
            <p class="meta">You have not rated this work yet. Rate it from My Reports.</p>
          </div>
        }

        <!-- Timeline: every status change -->
        <ion-list class="card-list ion-margin-top">
          <ion-item lines="none">
            <ion-label><strong>History</strong></ion-label>
          </ion-item>
          @for (e of r.events; track $index) {
            <ion-item>
              <ion-label class="ion-text-wrap">
                <h3>{{ statusLabel(e.status) }}</h3>
                @if (e.remark) {
                  <p>{{ e.remark }}</p>
                }
                <p class="meta">{{ e.changed_by_name }} · {{ e.changed_at | date: 'short' }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (!loading) {
        <div class="empty-card">This request could not be opened.</div>
      }
    </ion-content>
  `,
  styles: [`
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    .card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .card-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      padding: 0;
    }

    .card-list ion-item {
      --background: #fbfaf5;
      --border-color: #e2e8dc;
      --color: #29483d;
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .section {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #29483d;
    }

    .text {
      color: #29483d;
      margin: 8px 0;
    }

    .rating {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #29483d;
    }

    .meta {
      color: #87958a;
      font-size: 13px;
      margin: 0 0 4px;
    }

    .empty-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      color: #87958a;
      text-align: center;
    }
  `],
})
export class RequestDetailsPage {
  private route = inject(ActivatedRoute);
  private requestService = inject(RequestService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);

  detail: FacultyRequestDetail | null = null;
  loading = false;

  // Reload every time the page is shown, because the request may have changed meanwhile.
  async ionViewWillEnter() {
    await this.load();
  }

  private async load() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id < 1) {
      this.detail = null;
      await this.feedback.toast('That request link is not valid.');
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.detail = await this.requestService.getMyRequestDetail(id);
    } catch (e: any) {
      this.detail = null;
      await this.feedback.toast(e.message ?? 'Could not load this request.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // "10.52340, 118.91230", or a plain message when the device gave no location.
  formatCoords(lat: number | null, lng: number | null): string {
    if (lat === null || lng === null) {
      return 'Location not recorded';
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}