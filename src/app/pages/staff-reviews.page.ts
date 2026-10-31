import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { StaffReview } from '../models/request.model';
import { StaffJobService } from '../services/staff-job.service';
import { FeedbackService } from '../services/feedback.service';

// "Reviews" tab for staff (Step 7). Read-only: the ratings faculty left about this
// staff member's finished jobs, newest first. Reviews are final, so there is nothing to edit.
@Component({
  selector: 'app-staff-reviews',
  standalone: true,
  imports: [DatePipe, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>My Reviews</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="load()" [disabled]="loading">Refresh</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (count > 0) {
        <div class="summary-card">
          <p class="summary-main">{{ average }} / 5</p>
          <p class="meta">Average of {{ count }} {{ count === 1 ? 'review' : 'reviews' }}</p>
        </div>

        <ion-list class="card-list">
          @for (r of reviews; track r.id) {
            <ion-item lines="full">
              <ion-label class="ion-text-wrap">
                <h2>{{ r.title }} · {{ r.rating }}/5</h2>
                <p>{{ r.location_name }}</p>
                @if (r.comment) {
                  <p class="comment">{{ r.comment }}</p>
                } @else {
                  <p class="meta">No comment.</p>
                }
                <p class="meta">{{ r.reviewer_name }} · {{ r.created_at | date: 'mediumDate' }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else if (!loading) {
        <div class="empty-card">
          No reviews yet. They appear here after faculty rate your finished jobs.
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
    .summary-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 12px;
      text-align: center;
    }
    .summary-main {
      margin: 0 0 4px;
      font-size: 28px;
      font-weight: 700;
      color: #29483d;
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
    .card-list ion-item h2 {
      margin: 0 0 4px;
      font-weight: 700;
      color: #29483d;
    }
    .comment {
      color: #29483d;
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
      text-align: center;
    }
  `],
})
export class StaffReviewsPage {
  private staffService = inject(StaffJobService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);

  reviews: StaffReview[] = [];
  count = 0;
  average: number | null = null;
  loading = false;

  // Ionic calls this every time the tab is shown, so new ratings appear without a manual refresh.
  ionViewWillEnter() {
    this.load();
  }

  async load() {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const result = await this.staffService.loadReviews();
      this.reviews = result.reviews;
      this.count = result.summary.count;
      this.average = result.summary.average;
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load your reviews.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}