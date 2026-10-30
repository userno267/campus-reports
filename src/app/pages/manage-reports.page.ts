import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonModal, IonSelect, IonSelectOption, IonTitle, IonToolbar,
  IonBadge, IonSegment, IonSegmentButton,
} from '@ionic/angular';
import { ReportService } from '../services/report.service';
import { FeedbackService } from '../services/feedback.service';
import { ReportStatus } from '../models/report.model';

@Component({
  selector: 'app-manage-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList,
    IonModal, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonBadge,
    IonSegment, IonSegmentButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>Manage Reports</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      <!-- Status filter -->
      <ion-segment class="status-filter" [(ngModel)]="selectedStatus" (ionChange)="loadReports()">
        <ion-segment-button value="">All</ion-segment-button>
        <ion-segment-button value="submitted">Submitted</ion-segment-button>
        <ion-segment-button value="validated">Validated</ion-segment-button>
        <ion-segment-button value="tracked">Tracked</ion-segment-button>
        <ion-segment-button value="closed">Closed</ion-segment-button>
      </ion-segment>

      <!-- List of reports -->
      @if (reports.length > 0) {
        <ion-list class="report-list ion-margin-top">
          @for (report of reports; track report.id) {
            <ion-item button detail="false" (click)="openEditModal(report)">
              <ion-label>
                <h2>{{ report.title }}</h2>
                <p>{{ report.category_name }} · {{ report.priority || '—' }}</p>
                <p class="ion-text-sm meta-text">
                  {{ report.status }}
                  @if (report.routed_to_name) {
                    · Routed: {{ report.routed_to_name }}
                  }
                </p>
              </ion-label>
              <ion-badge slot="end" [color]="statusColor(report.status)">
                {{ report.status }}
              </ion-badge>
            </ion-item>
          }
        </ion-list>
      } @else {
        <div class="empty-card ion-margin-top">
          <p>No reports found.</p>
        </div>
      }
    </ion-content>

    <!-- Edit modal -->
    <ion-modal #editModal class="edit-modal" [isOpen]="showEditModal" (didDismiss)="showEditModal = false">
      @if (editingReport) {
        <ion-header class="ion-no-border">
          <ion-toolbar class="page-toolbar">
            <ion-title>Edit Report #{{ editingReport.id }}</ion-title>
            <ion-buttons slot="end">
              <ion-button class="close-btn" (click)="showEditModal = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding page-content">
          <div class="detail-card">
            <h3 class="detail-title">{{ editingReport.title }}</h3>
            <p class="meta-text">By {{ editingReport.created_by_name }} on {{ editingReport.created_at | date:'short' }}</p>

            @if (editingReport.description) {
              <p class="detail-text"><strong>Description:</strong> {{ editingReport.description }}</p>
            }
          </div>

          <ion-list class="report-list ion-margin-top">
            <ion-item detail="false">
              <ion-label>Category</ion-label>
              <ion-select [(ngModel)]="editForm.category_id">
                <ion-select-option [value]="null">None</ion-select-option>
                @for (cat of categories; track cat.id) {
                  <ion-select-option [value]="cat.id">{{ cat.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item detail="false">
              <ion-label>Priority</ion-label>
              <ion-select [(ngModel)]="editForm.priority">
                <ion-select-option [value]="null">None</ion-select-option>
                <ion-select-option value="low">Low</ion-select-option>
                <ion-select-option value="medium">Medium</ion-select-option>
                <ion-select-option value="high">High</ion-select-option>
                <ion-select-option value="urgent">Urgent</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item detail="false">
              <ion-label>Route to Personnel</ion-label>
              <ion-select [(ngModel)]="editForm.routed_to">
                <ion-select-option [value]="null">Unassigned</ion-select-option>
                @for (p of personnel; track p.id) {
                  <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
          </ion-list>

          <ion-button expand="block" class="save-btn ion-margin-top" [disabled]="saving" (click)="saveChanges()">
            {{ saving ? 'Saving...' : 'Save' }}
          </ion-button>
        </ion-content>
      }
    </ion-modal>
  `,
  styles: [`
    /* Same palette as tabs.page.ts and placeholder.page.ts */
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    /* Status filter: sage track with a light selected pill */
    .status-filter {
      --background: #e8efe3;
      border-radius: 12px;
      padding: 3px;
    }

    .status-filter ion-segment-button {
      --color: #87958a;
      --color-checked: #29483d;
      --indicator-color: #fbfaf5;
      --indicator-height: 100%;
      --indicator-border-radius: 10px;
      min-height: 36px;
      font-size: 12px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0.2px;
    }

    /* Report list and modal form: one rounded card with thin dividers */
    .report-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      padding: 0;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .report-list ion-item {
      --background: #fbfaf5;
      --border-color: #e2e8dc;
      --color: #29483d;
      --inner-padding-end: 8px;
    }

    .report-list ion-item h2 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #29483d;
    }

    .report-list ion-item p {
      margin: 0 0 2px;
      color: #29483d;
    }

    .meta-text {
      color: #87958a !important;
    }

    .empty-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      text-align: center;
      color: #87958a;
    }

    .empty-card p {
      margin: 0;
    }

    /* Edit modal */
    .edit-modal {
      --background: #f6f5ee;
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
      margin: 8px 0 0;
    }

    .close-btn {
      --color: #29483d;
    }

    .save-btn {
      --background: #29483d;
      --background-activated: #1f382f;
      --color: #fbfaf5;
      --border-radius: 14px;
      font-weight: 700;
      letter-spacing: 0.2px;
      text-transform: none;
    }
  `],
})
export class ManageReportsPage implements OnInit {
  private reportService = inject(ReportService);
  private cdr = inject(ChangeDetectorRef);
  private feedback = inject(FeedbackService);

  reports: any[] = [];
  personnel: any[] = [];
  categories: any[] = [];

  selectedStatus: string = '';
  showEditModal = false;
  editingReport: any = null;
  editForm: any = {};
  saving = false;

  async ngOnInit() {
    await this.loadReports();
    await this.loadPersonnel();
    await this.loadCategories();
  }

  // Ionic keeps tab pages alive, so reload when the tab is viewed
  async ionViewWillEnter() {
    console.log('[ManageReports] Tab entered, reloading...');
    await this.loadReports();
    this.cdr.markForCheck();
  }

  async loadReports() {
    try {
      this.reports = await this.reportService.getAllReports(this.selectedStatus || null);
      console.log('[ManageReports] Loaded', this.reports.length, 'reports');
      this.cdr.markForCheck();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load reports.');
    }
  }

  async loadPersonnel() {
    try {
      this.personnel = await this.reportService.getPersonnel();
      this.cdr.markForCheck();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load personnel.');
    }
  }

  async loadCategories() {
    try {
      this.categories = await this.reportService.getCategories();
      this.cdr.markForCheck();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load categories.');
    }
  }

  openEditModal(report: any) {
    this.editingReport = report;
    this.editForm = {
      category_id: report.category_id,
      priority: report.priority,
      routed_to: report.routed_to,
    };
    this.showEditModal = true;
  }

  async saveChanges() {
    if (!this.editingReport) return;

    this.saving = true;
    try {
      await this.reportService.updateReport(this.editingReport.id, this.editForm);
      await this.feedback.toast('Report updated.', 'success');
      this.showEditModal = false;
      await this.loadReports();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not save changes.');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  statusColor(status: ReportStatus): string {
    const colors: Record<ReportStatus, string> = {
      submitted: 'medium',
      validated: 'primary',
      tracked: 'warning',
      closed: 'success',
    };
    return colors[status] ?? 'medium';
  }
}