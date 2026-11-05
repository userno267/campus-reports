import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonSelect, IonSelectOption, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AdminRequestService } from '../services/admin-request.service';
import { FeedbackService } from '../services/feedback.service';
import { LiveUpdateService, LiveWatcher } from '../services/live-update.service';
import { AdminRequestDetail, AdminRequestRow, RequestStatus } from '../models/request.model';
import { PriorityBadgeComponent } from '../components/priority-badge.component';

// Friendly labels and badge colours (same as the Manage page).
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

// Order of the filter choices follows the lifecycle.
const STATUS_ORDER: RequestStatus[] = [
  'submitted', 'assigned', 'in_progress', 'awaiting_proof', 'completed', 'cancelled',
];

// Admin "Requests" tab (Step 8). A plain, read-only list of ALL requests in any status,
// with a status filter. Tap a row to see the photos, proof, history and the faculty rating.
// No actions here: assigning, cancelling and completing stay on the Manage tab.
// Not a dashboard: no counts, no charts, no workload.
@Component({
  selector: 'app-all-requests',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
    IonList, IonSelect, IonSelectOption, IonTitle, IonToolbar,
    PriorityBadgeComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        @if (selected) {
          <ion-buttons slot="start">
            <ion-button (click)="backToList()">Back</ion-button>
          </ion-buttons>
          <ion-title>Request #{{ selected.id }}</ion-title>
        } @else {
          <ion-title>All Requests</ion-title>
          <ion-buttons slot="end">
            <ion-button (click)="load()" [disabled]="loading">Refresh</ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (!selected) {
        <!-- ===== LIST ===== -->
        <ion-list class="card-list">
          <ion-item>
            <ion-select label="Status" labelPlacement="stacked" interface="popover"
                        [ngModel]="statusFilter"
                        (ionChange)="setFilter($event.detail.value)">
              <ion-select-option value="all">All statuses</ion-select-option>
              @for (s of statusOptions; track s) {
                <ion-select-option [value]="s">{{ statusLabel(s) }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </ion-list>

        @if (requests.length > 0) {
          <ion-list class="card-list ion-margin-top">
            @for (r of requests; track r.id) {
              <ion-item button detail="true" [disabled]="opening" (click)="openRequest(r.id)">
                <ion-label class="ion-text-wrap">
                  <h2>{{ r.title }}</h2>
                  <p>{{ r.category_name }} · {{ r.location_name }}</p>
                  <p class="meta">
                    {{ r.department_name ?? 'No department yet' }}
                    @if (r.assigned_name) {
                      · {{ r.assigned_name }}
                    }
                    · {{ r.created_at | date: 'mediumDate' }}
                  </p>
                </ion-label>
                <div slot="end" class="badges">
                  <app-priority-badge [priority]="r.priority" />
                  <ion-badge [color]="statusColor(r.status)">
                    {{ statusLabel(r.status) }}
                  </ion-badge>
                </div>
              </ion-item>
            }
          </ion-list>
        } @else if (!loading) {
          <div class="empty-card ion-margin-top">
            {{ statusFilter === 'all' ? 'No requests yet.' : 'No requests with this status.' }}
          </div>
        }
      } @else {
        <!-- ===== READ-ONLY DETAIL ===== -->
        <div class="detail-card">
          <h2 class="detail-title">{{ selected.title }}</h2>
          <p class="meta">
            {{ selected.category_name }} · {{ selected.location_name }} ·
            Reported {{ selected.created_at | date: 'mediumDate' }}
          </p>
          <p class="detail-text">{{ selected.description }}</p>
          <p class="meta">
            Status: {{ statusLabel(selected.status) }}
            @if (selected.department_name) {
              · Department: {{ selected.department_name }}
            }
            @if (selected.assigned_name) {
              · Staff: {{ selected.assigned_name }}
            }
          </p>
          @if (selected.priority) {
            <p class="meta">Priority: <app-priority-badge [priority]="selected.priority" /></p>
          }
        </div>

        <img class="photo"
             [src]="'data:image/jpeg;base64,' + selected.before_photo"
             alt="Before photo" />

        @if (selected.after_photo) {
          <div class="detail-card ion-margin-top">
            <h3 class="detail-title">Proof from staff</h3>
            @if (selected.proof_note) {
              <p class="detail-text">{{ selected.proof_note }}</p>
            } @else {
              <p class="meta">No note.</p>
            }
          </div>
          <img class="photo"
               [src]="'data:image/jpeg;base64,' + selected.after_photo"
               alt="After photo" />
        }

        <!-- Step 8: how the faculty member rated the work (only after completion). -->
        @if (selected.review) {
          <div class="detail-card ion-margin-top">
            <h3 class="detail-title">Faculty rating</h3>
            <p class="detail-text">{{ selected.review.rating }} / 5</p>
            @if (selected.review.comment) {
              <p class="detail-text">{{ selected.review.comment }}</p>
            }
            <p class="meta">
              {{ selected.review.reviewer_name }} · {{ selected.review.created_at | date: 'mediumDate' }}
            </p>
          </div>
        } @else if (selected.status === 'completed') {
          <div class="detail-card ion-margin-top">
            <p class="meta">Not rated yet.</p>
          </div>
        }

        <ion-list class="card-list ion-margin-top">
          <ion-item lines="none">
            <ion-label><strong>History</strong></ion-label>
          </ion-item>
          @for (e of selected.events; track $index) {
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

        <p class="meta ion-text-center ion-margin-top">
          Read-only. To assign, cancel or complete a request, use the Manage tab.
        </p>
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

    .card-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      padding: 0;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .card-list ion-item {
      --background: #fbfaf5;
      --border-color: #e2e8dc;
      --color: #29483d;
    }

    .card-list ion-item h2,
    .card-list ion-item h3 {
      margin: 0 0 4px;
      font-weight: 700;
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

    .detail-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .detail-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .detail-text {
      color: #29483d;
      margin: 8px 0 4px;
    }

    .badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .photo {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
    }
  `],
})
export class AllRequestsPage implements OnDestroy {
  private adminService = inject(AdminRequestService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);
  private live = inject(LiveUpdateService);
  private watcher: LiveWatcher | null = null;

  readonly statusOptions = STATUS_ORDER;

  requests: AdminRequestRow[] = [];
  selected: AdminRequestDetail | null = null;
  statusFilter: RequestStatus | 'all' = 'all';
  loading = false;
  opening = false;

  // Counts every load. A slow answer for an old filter is ignored when a newer load started.
  private loadSeq = 0;

  // Ionic keeps tab pages alive, so start watching each time the tab is shown.
  // The list loads now, and again by itself whenever any request changes.
  // While a detail is open the screen is left alone, so the admin is not thrown back to the list.
  // backToList() reloads, so nothing is missed.
  ionViewWillEnter() {
    this.watcher?.stop();
    this.watcher = this.live.watch('list', async (silent) => {
      if (!this.selected) {
        await this.load(silent);
      }
    });
  }

  // Live updates: stop checking when the screen is left or destroyed.
  ionViewWillLeave() {
    this.stopWatching();
  }

  ngOnDestroy() {
    this.stopWatching();
  }

  private stopWatching() {
    this.watcher?.stop();
    this.watcher = null;
  }

  // silent = true is a background refresh: no spinner and no error message.
  async load(silent = false) {
    const seq = ++this.loadSeq;
    if (!silent) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    try {
      const rows = await this.adminService.loadAll(this.statusFilter === 'all' ? null : this.statusFilter);
      if (seq === this.loadSeq) {
        this.requests = rows;
      }
    } catch (e: any) {
      if (seq === this.loadSeq && !silent) {
        await this.feedback.toast(e.message ?? 'Could not load the requests.');
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  async setFilter(value: RequestStatus | 'all') {
    if (value === this.statusFilter) return;
    this.statusFilter = value;
    await this.load();
  }

  async openRequest(id: number) {
    if (this.opening) return; // ignore a double tap
    this.opening = true;
    this.cdr.markForCheck();
    try {
      this.selected = await this.adminService.loadDetail(id);
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not open the request.');
    } finally {
      this.opening = false;
      this.cdr.markForCheck();
    }
  }

  backToList() {
    this.selected = null;
    this.load();
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}