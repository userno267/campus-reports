import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonLabel, IonList, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AdminRequestService } from '../services/admin-request.service';
import { FeedbackService } from '../services/feedback.service';
import {
  AdminRequestDetail, AdminRequestRow, RequestStatus, StaffMember,
} from '../models/request.model';
import { Department } from '../models/user.model';

// Friendly labels and badge colours for each status (same as My Reports).
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

// The admin's choices on the detail screen. null means nothing chosen yet.
interface AssignForm {
  department_id: number | null;
  staff_id: number | null;
  remark: string;
}

// Admin "Manage" tab. Two views on one page:
//  1. the queue (submitted and assigned requests)
//  2. the detail view for one request: photo, timeline, department, staff, actions
// Why no separate detail page: fewer routes, and the queue stays loaded when you go back.
@Component({
  selector: 'app-manage-reports',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
    IonList, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        @if (selected) {
          <ion-buttons slot="start">
            <ion-button (click)="backToQueue()">Back</ion-button>
          </ion-buttons>
          <ion-title>Request #{{ selected.id }}</ion-title>
        } @else {
          <ion-title>Manage Requests</ion-title>
          <ion-buttons slot="end">
            <ion-button (click)="loadQueue()" [disabled]="loading">Refresh</ion-button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (!selected) {
        <!-- ===== QUEUE ===== -->
        @if (queue.length > 0) {
          <ion-list class="card-list">
            @for (r of queue; track r.id) {
              <ion-item button detail="true" (click)="openRequest(r.id)">
                <ion-label class="ion-text-wrap">
                  <h2>{{ r.title }}</h2>
                  <p>{{ r.category_name }} · {{ r.location_name }}</p>
                  <p class="meta">
                    Suggested: {{ departmentName(r.suggested_department_id) }}
                    @if (r.assigned_name) {
                      · Assigned to {{ r.assigned_name }}
                    }
                  </p>
                </ion-label>
                <ion-badge slot="end" [color]="statusColor(r.status)">
                  {{ statusLabel(r.status) }}
                </ion-badge>
              </ion-item>
            }
          </ion-list>
        } @else if (!loading) {
          <div class="empty-card">No requests waiting for review.</div>
        }
      } @else {
        <!-- ===== DETAIL ===== -->
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
          </p>
        </div>

        <img class="before-photo"
             [src]="'data:image/jpeg;base64,' + selected.before_photo"
             alt="Before photo" />

        <!-- Assignment form. Only while the request is still submitted or assigned. -->
        @if (canChange) {
          <ion-list class="card-list ion-margin-top">
            <ion-item>
              <ion-select label="Department" labelPlacement="stacked" interface="popover"
                          [ngModel]="form.department_id"
                          (ionChange)="setDepartment($event.detail.value)">
                @for (d of departments; track d.id) {
                  <ion-select-option [value]="d.id">{{ d.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-select label="Staff member" labelPlacement="stacked" interface="popover"
                          [disabled]="!form.department_id"
                          [(ngModel)]="form.staff_id">
                @for (s of staffForDepartment(); track s.id) {
                  <ion-select-option [value]="s.id"
                                     [disabled]="!s.is_available && s.id !== selected.assigned_to">
                    {{ s.name }} ({{ s.is_available ? 'available' : 'busy' }})
                  </ion-select-option>
                } @empty {
                  <ion-select-option [value]="null" disabled>No staff in this department</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-textarea label="Remark (optional)" labelPlacement="stacked" [autoGrow]="true"
                            maxlength="300" placeholder="For example: please come before 2 pm"
                            [(ngModel)]="form.remark"></ion-textarea>
            </ion-item>
          </ion-list>

          <ion-button expand="block" class="action-btn ion-margin-top"
                      [disabled]="busy || !form.department_id || !form.staff_id"
                      (click)="submitAssign()">
            {{ busy ? 'Saving...' : (selected.status === 'assigned' ? 'Reassign' : 'Assign') }}
          </ion-button>

          <ion-button expand="block" fill="outline" color="danger" class="ion-margin-top"
                      [disabled]="busy" (click)="confirmCancel()">
            Cancel request
          </ion-button>
        }

        <!-- Timeline: every status change -->
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
      }
    </ion-content>
  `,
  styles: [`
    /* Same palette as my-reports.page.ts and the other admin pages */
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

    .before-photo {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
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
export class ManageReportsPage implements OnInit {
  private adminService = inject(AdminRequestService);
  private feedback = inject(FeedbackService);
  private alertCtrl = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  queue: AdminRequestRow[] = [];
  departments: Department[] = [];
  allStaff: StaffMember[] = [];
  selected: AdminRequestDetail | null = null;
  form: AssignForm = { department_id: null, staff_id: null, remark: '' };
  loading = false;
  busy = false;

  // Departments rarely change, so load them once when the page is created.
  async ngOnInit() {
    await this.loadDepartments();
  }

  // Ionic keeps tab pages alive, so refresh the queue every time the tab is shown.
  async ionViewWillEnter() {
    await this.loadQueue();
  }

  async loadDepartments() {
    try {
      this.departments = await this.adminService.getDepartments();
      this.cdr.markForCheck();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load departments.');
    }
  }

  async loadQueue() {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.queue = await this.adminService.loadQueue();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load the request queue.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadStaff() {
    try {
      this.allStaff = await this.adminService.getStaff();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load staff.');
    }
  }

  // Open one request. The department starts at the admin's current choice,
  // or the category's suggestion. The staff member starts at the current assignee.
  async openRequest(id: number) {
    try {
      const detail = await this.adminService.loadDetail(id);
      await this.loadStaff();
      this.selected = detail;
      this.form = {
        department_id: detail.department_id ?? detail.suggested_department_id,
        staff_id: detail.assigned_to,
        remark: '',
      };
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not open the request.');
    }
    this.cdr.markForCheck();
  }

  backToQueue() {
    this.selected = null;
    this.loadQueue();
  }

  // Only the new department's staff can be picked. Available staff are listed first.
  staffForDepartment(): StaffMember[] {
    const deptId = this.form.department_id;
    if (!deptId) return [];
    return this.allStaff
      .filter((s) => s.department_id === deptId)
      .sort((a, b) => Number(b.is_available) - Number(a.is_available));
  }

  // Changing the department clears the staff choice if that person is not in the new department.
  setDepartment(value: number) {
    this.form.department_id = value;
    const stillValid = this.staffForDepartment().some((s) => s.id === this.form.staff_id);
    if (!stillValid) {
      this.form.staff_id = null;
    }
    this.cdr.markForCheck();
  }

  // Assign (first time) or reassign. Both use the same server action.
  async submitAssign() {
    if (!this.selected) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.adminService.assign({
        request_id: this.selected.id,
        department_id: this.form.department_id,
        staff_id: this.form.staff_id,
        remark: this.form.remark.trim(),
      });
      await this.feedback.toast('Request assigned.', 'success');
      this.selected = null;
      await this.loadQueue();
    } catch (e: any) {
      // Stay on the detail view so the admin can pick someone else.
      await this.feedback.toast(e.message ?? 'Could not assign the request.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // Ask first: cancelling cannot be undone.
  async confirmCancel() {
    if (!this.selected) return;
    const requestId = this.selected.id;

    const alert = await this.alertCtrl.create({
      header: 'Cancel this request?',
      message: 'The request will be closed. This cannot be undone.',
      buttons: [
        { text: 'Keep it', role: 'cancel' },
        { text: 'Yes, cancel', role: 'destructive', handler: () => this.doCancel(requestId) },
      ],
    });
    await alert.present();
  }

  private async doCancel(requestId: number) {
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.adminService.cancel(requestId, this.form.remark.trim());
      await this.feedback.toast('Request cancelled.', 'success');
      this.selected = null;
      await this.loadQueue();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not cancel the request.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // The assign form is only shown while the request is still open.
  get canChange(): boolean {
    return this.selected?.status === 'submitted' || this.selected?.status === 'assigned';
  }

  departmentName(id: number): string {
    return this.departments.find((d) => d.id === id)?.name ?? '—';
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}