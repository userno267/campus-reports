import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { DailyReportService } from '../services/daily-report.service';
import { FeedbackService } from '../services/feedback.service';
import { DailyReport } from '../models/daily-report.model';
import { PriorityBadgeComponent } from '../components/priority-badge.component';
import {
  buildDailyReportPdf, dailyReportFileName, formatDuration, formatPh, formatPhTime,
} from '../utils/daily-report-pdf.util';

// How often the preview refreshes while the report is for TODAY and the tab is visible.
// A record for a past day never changes, so it is loaded once.
const TODAY_REFRESH_MS = 30000;

// Today's date in Philippine time as YYYY-MM-DD, whatever the device's own time zone is.
function todayPh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// Admin "Report" tab. A RECORD ONLY: no rankings, targets, averages or scores.
// The preview and the PDF are built from the same data, so they agree.
@Component({
  selector: 'app-daily-report',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
    PriorityBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>Daily Report</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">

      <!-- ===== DATE + DOWNLOAD ===== -->
      <div class="card">
        <ion-item lines="none" class="date-item">
          <ion-label position="stacked">Date (Philippine time)</ion-label>
          <ion-input type="date" [ngModel]="date" (ionChange)="onDateChange($event.detail.value)"></ion-input>
        </ion-item>
        <div class="row-actions">
          <ion-button fill="outline" size="small" (click)="useToday()" [disabled]="loading">Today</ion-button>
          <ion-button size="small" (click)="downloadPdf()" [disabled]="loading || !report">Download PDF</ion-button>
        </div>
        @if (report) {
          <p class="meta">
            Generated {{ report.generated_at | date: 'medium' }} by {{ report.generated_by.name }}
            @if (isToday) { · refreshes every 30 seconds }
          </p>
        }
      </div>

      @if (loading && !report) {
        <div class="empty-card">Loading the report…</div>
      }

      @if (report) {
        <!-- ===== SUMMARY ===== -->
        <div class="card">
          <h3 class="section-title">Summary</h3>
          <div class="summary-grid">
            <div class="stat"><span class="stat-value">{{ report.summary.completed }}</span><span class="meta">Completed</span></div>
            <div class="stat"><span class="stat-value">{{ report.summary.still_open }}</span><span class="meta">Still open</span></div>
            <div class="stat"><span class="stat-value">{{ report.summary.new_reports }}</span><span class="meta">New reports</span></div>
            <div class="stat"><span class="stat-value">{{ report.summary.cancelled }}</span><span class="meta">Cancelled</span></div>
          </div>
        </div>

        <!-- ===== WHO DID WHAT ===== -->
        <div class="card">
          <h3 class="section-title">Who did what</h3>
          @if (report.who_did_what.length === 0) {
            <p class="meta">No jobs completed on this date.</p>
          } @else {
            <ion-list class="plain-list">
              @for (row of report.who_did_what; track row.request_id) {
                <ion-item lines="inset">
                  <ion-label class="ion-text-wrap">
                    <h2>{{ row.staff_name ?? 'No staff recorded' }}</h2>
                    <p>Request #{{ row.request_id }} · {{ row.location_name }}</p>
                  </ion-label>
                  <span slot="end" class="meta">{{ formatTime(row.completed_at) }}</span>
                </ion-item>
              }
            </ion-list>
          }
        </div>

        <!-- ===== COMPLETED JOBS ===== -->
        @if (report.completed.length > 0) {
          <h3 class="group-title">Completed jobs</h3>
          @for (job of report.completed; track job.id) {
            <div class="card job-card">
              <h2 class="job-title">#{{ job.id }} · {{ job.title }}</h2>
              <p class="meta">{{ job.category_name }} · {{ job.location_name }} · {{ job.department_name ?? 'No department' }}</p>
              @if (job.priority) {
                <p class="meta">Priority: <app-priority-badge [priority]="job.priority" /></p>
              }
              <p class="detail-text">{{ job.description }}</p>

              <dl class="facts">
                <dt>Reported by</dt><dd>{{ job.reporter_name ?? '-' }}</dd>
                <dt>Done by</dt><dd>{{ job.staff_name ?? '-' }}{{ job.staff_employee_id ? ' (ID ' + job.staff_employee_id + ')' : '' }}</dd>
                <dt>Approved by</dt><dd>{{ job.approved_by_name ?? '-' }}</dd>
                <dt>Reported</dt><dd>{{ formatFull(job.reported_at) }}</dd>
                <dt>Assigned</dt><dd>{{ formatFull(job.assigned_at) }}</dd>
                <dt>Started</dt><dd>{{ formatFull(job.started_at) }}</dd>
                <dt>Proof sent</dt><dd>{{ formatFull(job.proof_sent_at) }}</dd>
                <dt>Completed</dt><dd>{{ formatFull(job.completed_at) }}</dd>
                <dt>Time to complete</dt><dd>{{ duration(job.reported_at, job.completed_at) }}</dd>
                @if (job.send_back_count > 0) {
                  <dt>Sent back</dt><dd>{{ job.send_back_count }} time{{ job.send_back_count === 1 ? '' : 's' }}</dd>
                }
                @if (job.latitude !== null && job.longitude !== null) {
                  <dt>Coordinates</dt><dd>{{ job.latitude.toFixed(5) }}, {{ job.longitude.toFixed(5) }}</dd>
                }
              </dl>

              <p class="block-label">Work done</p>
              <p class="detail-text">{{ job.proof_note ?? 'No note written.' }}</p>
              @if (job.admin_remark) {
                <p class="block-label">Admin remark</p>
                <p class="detail-text">{{ job.admin_remark }}</p>
              }
              <p class="block-label">Rating</p>
              @if (job.rating !== null) {
                <p class="detail-text">{{ job.rating }} / 5 · by {{ job.reviewer_name ?? 'faculty' }}</p>
                @if (job.review_comment) {
                  <p class="detail-text">“{{ job.review_comment }}”</p>
                }
              } @else {
                <p class="detail-text">Not rated yet.</p>
              }
            </div>
          }
        }

        <!-- ===== STILL OPEN ===== -->
        <h3 class="group-title">Still open</h3>
        @if (report.still_open.length === 0) {
          <div class="empty-card">No open jobs with activity on this date.</div>
        } @else {
          <div class="card">
            <ion-list class="plain-list">
              @for (job of report.still_open; track job.id) {
                <ion-item lines="inset">
                  <ion-label class="ion-text-wrap">
                    <h2>#{{ job.id }} · {{ job.title }}</h2>
                    <p>{{ statusText(job.status) }} · {{ job.staff_name ?? 'No staff yet' }}</p>
                    <p class="meta">Reported {{ formatFull(job.reported_at) }} · {{ job.location_name }}</p>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </div>
        }
      }
    </ion-content>
  `,
  styles: [`
    /* Force a light page with black text, whatever the phone's dark mode setting is.
       Ionic reads these variables, so every ion-item, ion-label and toolbar on this page follows them. */
    :host {
      --ion-background-color: #f6f5ee;
      --ion-background-color-rgb: 246, 245, 238;
      --ion-text-color: #000000;
      --ion-text-color-rgb: 0, 0, 0;
      --ion-item-background: #ffffff;
      --ion-item-color: #000000;
      --ion-toolbar-background: #ffffff;
      --ion-toolbar-color: #000000;
      --ion-card-background: #ffffff;
      --ion-card-color: #000000;
    }

    .page-content {
      --background: #f6f5ee;
      --color: #000000;
    }

    .page-toolbar {
      --background: #ffffff;
      --color: #000000;
      border-bottom: 1px solid #d9d9d9;
    }

    .card {
      background: #ffffff;
      border: 1px solid #d9d9d9;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
      color: #000000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .job-card { margin-bottom: 18px; }

    .empty-card {
      background: #ffffff;
      border: 1px solid #d9d9d9;
      border-radius: 14px;
      padding: 16px;
      color: #000000;
      text-align: center;
      margin-bottom: 14px;
    }

    .section-title,
    .job-title {
      margin: 0 0 8px;
      font-weight: 700;
      color: #000000;
    }

    .job-title { font-size: 16px; }

    .group-title {
      margin: 6px 4px 8px;
      color: #000000;
      font-size: 15px;
      font-weight: 700;
    }

    .meta {
      color: #000000;
      font-size: 13px;
      margin: 4px 0;
      opacity: 0.8;
    }

    .detail-text {
      color: #000000;
      font-size: 14px;
      margin: 4px 0 8px;
      white-space: pre-wrap;
    }

    .block-label {
      margin: 10px 0 2px;
      color: #000000;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .date-item {
      --background: transparent;
      --color: #000000;
      --highlight-color-focused: #000000;
      padding: 0;
    }

    .date-item ion-label,
    .date-item ion-input {
      color: #000000;
    }

    .row-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .stat {
      background: #eeeeee;
      border-radius: 12px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      color: #000000;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #000000;
    }

    .plain-list {
      background: transparent;
      padding: 0;
    }

    .plain-list ion-item {
      --background: #ffffff;
      --color: #000000;
      --border-color: #d9d9d9;
    }

    .plain-list ion-item h2,
    .plain-list ion-item p,
    .plain-list ion-item span {
      color: #000000;
    }

    .plain-list ion-item h2 {
      font-weight: 700;
      margin: 0 0 4px;
    }

    .facts {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 4px 10px;
      font-size: 13px;
      margin: 8px 0 0;
      color: #000000;
    }

    .facts dt {
      color: #000000;
      font-weight: 600;
    }

    .facts dd {
      margin: 0;
      color: #000000;
    }
  `],
})
export class DailyReportPage implements OnInit, OnDestroy {
  private reportService = inject(DailyReportService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);

  // YYYY-MM-DD in Philippine time. Starts as today.
  date = todayPh();
  report: DailyReport | null = null;
  loading = false;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // Exposed to the template: the shared formatters, so the preview and the PDF match.
  formatTime = formatPhTime;
  formatFull = formatPh;
  duration = formatDuration;

  get isToday(): boolean {
    return this.date === todayPh();
  }

  ngOnInit(): void {
    void this.load(false);
    this.startTodayRefresh();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    this.stopTodayRefresh();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  // Ionic keeps a tab alive, so reload when the admin comes back to it.
  ionViewWillEnter(): void {
    void this.load(true);
  }

  onDateChange(value: string | null | undefined): void {
    if (!value || value === this.date) return;
    this.date = value;
    this.startTodayRefresh();
    void this.load(false);
  }

  useToday(): void {
    this.onDateChange(todayPh());
  }

  // silent = true means refresh in the background, without the spinner text or an error toast.
  async load(silent: boolean): Promise<void> {
    if (this.loading) return;
    this.loading = !silent;
    try {
      this.report = await this.reportService.load(this.date);
    } catch (e: any) {
      if (!silent) {
        await this.feedback.toast(e?.message ?? 'Could not load the report.', 'danger');
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Only today's report can change, so only today refreshes on a timer.
  private startTodayRefresh(): void {
    this.stopTodayRefresh();
    if (this.isToday) {
      this.refreshTimer = setInterval(() => {
        if (!document.hidden) void this.load(true);
      }, TODAY_REFRESH_MS);
    }
  }

  private stopTodayRefresh(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Coming back to the app: refresh at once.
  private onVisibility = (): void => {
    if (!document.hidden && this.isToday) void this.load(true);
  };

  statusText(status: string): string {
    const labels: Record<string, string> = {
      assigned: 'Assigned',
      in_progress: 'In progress',
      awaiting_proof: 'Awaiting proof',
    };
    return labels[status] ?? status;
  }

  // Builds the PDF from the same report on screen and saves it.
  // Browser: a normal download. Phone: the download goes to the phone's download folder.
  // Native file saving (Feature 8) is not built yet, so this uses the browser path only.
  downloadPdf(): void {
    if (!this.report) return;
    try {
      const blob = buildDailyReportPdf(this.report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dailyReportFileName(this.report);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before freeing the file.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      void this.feedback.toast('Could not build the PDF. Please try again.', 'danger');
    }
  }
}