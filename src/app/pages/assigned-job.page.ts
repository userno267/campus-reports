import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonList, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { RequestStatus, StaffJob } from '../models/request.model';
import { StaffJobService } from '../services/staff-job.service';
import { FeedbackService } from '../services/feedback.service';
import { resizeImageToBase64 } from '../utils/photo.util';

// Staff-facing labels and badge colours for each status.
const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  assigned: 'Not started',
  in_progress: 'In progress',
  awaiting_proof: 'Waiting for review',
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

// "Assigned" tab for staff. Shows the one active job and walks through three steps:
// assigned -> started -> proof sent (awaiting admin review).
// Why no separate detail page: the job is always the same single item.
@Component({
  selector: 'app-assigned-job',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonList, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>My Job</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="load()" [disabled]="loading || busy">Refresh</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (job) {
        <!-- The job itself -->
        <div class="job-card">
          <div class="job-head">
            <h2 class="job-title">{{ job.title }}</h2>
            <ion-badge [color]="statusColor(job.status)">{{ statusLabel(job.status) }}</ion-badge>
          </div>
          <p class="meta">
            {{ job.category_name }} · {{ job.location_name }} ·
            Updated {{ job.updated_at | date: 'medium' }}
          </p>
          <p class="detail-text">{{ job.description }}</p>
          <img class="photo"
               [src]="'data:image/jpeg;base64,' + job.before_photo"
               alt="Problem photo" />
        </div>

        <!-- Step 1: assigned, not started yet -->
        @if (job.status === 'assigned') {
          <ion-button expand="block" class="action-btn ion-margin-top"
                      [disabled]="busy" (click)="startJob()">
            {{ busy ? 'Saving...' : 'Mark as started' }}
          </ion-button>
        }

        <!-- Step 2: in progress, send proof of the finished work -->
        @if (job.status === 'in_progress') {
          <div class="job-card ion-margin-top">
            <h3 class="section-title">Proof of completed work</h3>
            <p class="meta">Take a photo of the finished work, add an optional note, then send it to the admin.</p>

            <input class="file-input" type="file" accept="image/*" capture="environment"
                   (change)="onPhotoPicked($event)" />

            @if (previewSrc) {
              <img class="photo" [src]="previewSrc" alt="After photo preview" />
            }

            <ion-list class="note-list">
              <ion-item>
                <ion-textarea label="Note (optional)" labelPlacement="stacked" [autoGrow]="true"
                              maxlength="300" placeholder="For example: replaced the filter"
                              [(ngModel)]="note"></ion-textarea>
              </ion-item>
            </ion-list>

            <ion-button expand="block" class="action-btn ion-margin-top"
                        [disabled]="busy || !afterPhoto" (click)="submitProof()">
              {{ busy ? 'Sending...' : 'Send proof' }}
            </ion-button>
          </div>
        }

        <!-- Step 3: proof sent, waiting for the admin -->
        @if (job.status === 'awaiting_proof') {
          <div class="job-card ion-margin-top">
            <h3 class="section-title">Proof sent</h3>
            <p class="meta">Waiting for the admin to review your work.</p>
            @if (job.after_photo) {
              <img class="photo"
                   [src]="'data:image/jpeg;base64,' + job.after_photo"
                   alt="Your after photo" />
            }
            @if (job.proof_note) {
              <p class="detail-text"><strong>Your note:</strong> {{ job.proof_note }}</p>
            }
          </div>
        }
      } @else if (!loading) {
        <div class="empty-card">
          No active job right now. New jobs appear here when the admin assigns you one.
        </div>
      }
    </ion-content>
  `,
  styles: [`
    /* Same palette as the other pages */
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    .job-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .job-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .job-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .section-title {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #29483d;
    }

    .detail-text {
      color: #29483d;
      margin: 8px 0;
    }

    .meta {
      color: #87958a;
      font-size: 13px;
      margin: 0 0 4px;
    }

    .photo {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
    }

    .file-input {
      display: block;
      margin: 12px 0;
      color: #29483d;
    }

    .note-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      margin-top: 12px;
    }

    .note-list ion-item {
      --background: #fbfaf5;
      --color: #29483d;
    }

    .empty-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      color: #87958a;
      text-align: center;
    }

    .action-btn {
      --background: #29483d;
      --background-activated: #1f382f;
      --color: #fbfaf5;
      --border-radius: 14px;
      font-weight: 700;
      text-transform: none;
    }
  `],
})
export class AssignedJobPage {
  private jobService = inject(StaffJobService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);

  job: StaffJob | null = null;
  loading = false;
  busy = false;

  // The proof the staff member is preparing. Cleared after it is sent.
  afterPhoto: string | null = null;   // raw base64 for the API
  previewSrc: string | null = null;   // data URL for the preview image
  note = '';

  // Ionic keeps tab pages alive, so reload every time the tab is shown.
  ionViewWillEnter() {
    this.load();
  }

  async load() {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const job = await this.jobService.loadCurrent();
      // A different job means the old photo and note do not belong to it.
      if (job?.id !== this.job?.id) {
        this.clearProof();
      }
      this.job = job;
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load your job.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async startJob() {
    if (!this.job) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.job = await this.jobService.start(this.job.id);
      await this.feedback.toast('Job started.', 'success');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not start the job.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // Resize the photo in the browser first, so the upload stays small.
  async onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.afterPhoto = await resizeImageToBase64(file);
      this.previewSrc = 'data:image/jpeg;base64,' + this.afterPhoto;
    } catch (e: any) {
      await this.feedback.toast('Could not read that photo. Please try again.');
    } finally {
      // Clear the input so picking the same photo again still fires the change event.
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  async submitProof() {
    if (!this.job) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.job = await this.jobService.submitProof(this.job.id, this.afterPhoto, this.note);
      this.clearProof();
      await this.feedback.toast('Proof sent to the admin.', 'success');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not send the proof.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private clearProof() {
    this.afterPhoto = null;
    this.previewSrc = null;
    this.note = '';
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}