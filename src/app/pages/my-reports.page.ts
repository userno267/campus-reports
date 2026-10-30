import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonLabel, IonList, IonTitle, IonToolbar,
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

// Faculty's own requests, newest first.
@Component({
  selector: 'app-my-reports',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonLabel, IonList, IonTitle, IonToolbar,
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
        <ion-list class="card-list">
          @for (r of requests; track r.id) {
            <ion-item lines="none" class="request-card">
              <ion-label class="ion-text-wrap">
                <h2>{{ r.title }}</h2>
                <p>{{ r.category_name }} · {{ r.location_name }}</p>
                <p class="meta">Reported {{ r.created_at | date: 'mediumDate' }}</p>
              </ion-label>
              <ion-badge slot="end" [color]="statusColor(r.status)">
                {{ statusLabel(r.status) }}
              </ion-badge>
            </ion-item>
          }
        </ion-list>
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
      --background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      margin-bottom: 10px;
    }
    .meta {
      color: #87958a;
      font-size: 13px;
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

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}