import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonLabel, IonList, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { RequestStatus, RequestSummary } from '../models/request.model';
import { RequestService } from '../services/request.service';
import { FeedbackService } from '../services/feedback.service';

// Friendly labels and badge colours for each status.
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

// The rating choices. 5 first so the best answer is the easiest to reach.
const RATING_CHOICES = [
  { value: 5, label: '5 - Excellent' },
  { value: 4, label: '4 - Good' },
  { value: 3, label: '3 - Okay' },
  { value: 2, label: '2 - Poor' },
  { value: 1, label: '1 - Very poor' },
];

// Faculty's own requests, newest first.
// Step 6: a completed request shows "Rate the work". The form opens inside the card
// (no modal, no extra route). Only one form is open at a time.
@Component({
  selector: 'app-my-reports',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>My Reports</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="load()" [disabled]="loading">Refresh</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (requests.length > 0) {
        @for (r of requests; track r.id) {
          <div class="request-card">
            <ion-item lines="none" class="request-row">
              <ion-label class="ion-text-wrap">
                <h2>{{ r.title }}</h2>
                <p>{{ r.category_name }} · {{ r.location_name }}</p>
                <p class="meta">Reported {{ r.created_at | date: 'mediumDate' }}</p>
                @if (r.staff_name) {
                  <p class="meta">Done by {{ r.staff_name }}</p>
                }
              </ion-label>
              <ion-badge slot="end" [color]="statusColor(r.status)">
                {{ statusLabel(r.status) }}
              </ion-badge>
            </ion-item>

            @if (r.status === 'completed') {
              @if (r.has_review) {
                <p class="rated">Rated {{ r.review_rating }}/5</p>
              } @else if (ratingFor !== r.id) {
                <div class="card-actions">
                  <ion-button size="small" class="action-btn" (click)="openRating(r.id)">
                    Rate the work
                  </ion-button>
                </div>
              } @else {
                <div class="rating-form">
                  <ion-item>
                    <ion-select label="Rating" labelPlacement="stacked" interface="popover"
                                placeholder="Choose 1 to 5" [(ngModel)]="rating">
                      @for (c of ratingChoices; track c.value) {
                        <ion-select-option [value]="c.value">{{ c.label }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                  <ion-item>
                    <ion-textarea label="Comment (optional)" labelPlacement="stacked"
                                  [autoGrow]="true" maxlength="300"
                                  placeholder="How was the work?"
                                  [(ngModel)]="comment"></ion-textarea>
                  </ion-item>
                  <p class="meta note">A rating is final. You cannot change it later.</p>
                  <div class="card-actions">
                    <ion-button size="small" fill="outline" [disabled]="saving" (click)="closeRating()">
                      Cancel
                    </ion-button>
                    <ion-button size="small" class="action-btn"
                                [disabled]="saving || rating === null"
                                (click)="submitRating(r.id)">
                      {{ saving ? 'Saving...' : 'Submit rating' }}
                    </ion-button>
                  </div>
                </div>
              }
            }
          </div>
        }
      } @else if (!loading) {
        <div class="empty-card">
          No requests yet. Use New Report to report a problem.
        </div>
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
    .request-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .request-row {
      --background: transparent;
    }
    .meta {
      color: #87958a;
      font-size: 13px;
    }
    .note {
      padding: 0 16px;
      margin: 8px 0 0;
    }
    .rated {
      margin: 0;
      padding: 0 16px 12px;
      color: #29483d;
      font-weight: 700;
      font-size: 14px;
    }
    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 4px 16px 12px;
    }
    .rating-form ion-item {
      --background: #fbfaf5;
      --border-color: #e2e8dc;
      --color: #29483d;
    }
    .action-btn {
      --background: #29483d;
      --background-activated: #1f382f;
      --color: #fbfaf5;
      --border-radius: 14px;
      font-weight: 700;
      text-transform: none;
    }
    .empty-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      color: #87958a;
    }
  `],
})
export class MyReportsPage {
  private requestService = inject(RequestService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);

  requests: RequestSummary[] = [];
  loading = false;

  // Rating form state. ratingFor is the id of the request whose form is open (null = none).
  ratingChoices = RATING_CHOICES;
  ratingFor: number | null = null;
  rating: number | null = null;
  comment = '';
  saving = false;

  // Ionic calls this every time the tab is shown, so the list is always fresh.
  ionViewWillEnter() {
    this.load();
  }

  async load() {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.requests = await this.requestService.getMyRequests();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load your requests.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Opening a form for another request replaces the one that was open.
  openRating(requestId: number) {
    this.ratingFor = requestId;
    this.rating = null;
    this.comment = '';
    this.cdr.markForCheck();
  }

  closeRating() {
    this.ratingFor = null;
    this.cdr.markForCheck();
  }

  async submitRating(requestId: number) {
    this.saving = true;
    this.cdr.markForCheck();
    try {
      await this.requestService.submitReview(requestId, this.rating, this.comment);
      await this.feedback.toast('Thank you for your rating.', 'success');
      this.ratingFor = null;
      await this.load(); // shows "Rated n/5" from the server
    } catch (e: any) {
      // Keep the form open so nothing typed is lost.
      await this.feedback.toast(e.message ?? 'Could not save your rating.');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}