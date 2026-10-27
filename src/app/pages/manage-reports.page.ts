import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonModal, IonSelect, IonSelectOption, IonTitle, IonToolbar,
  IonBadge, IonSegment, IonSegmentButton,
} from '@ionic/angular';
import { ReportService } from '../services/report.service';
import { FeedbackService } from '../services/feedback.service';
import { ReportStatus, Priority } from '../models/report.model';

@Component({
  selector: 'app-manage-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList,
    IonModal, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonBadge,
    IonSegment, IonSegmentButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Manage Reports</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Status filter -->
      <ion-segment [(ngModel)]="selectedStatus" (ionChange)="loadReports()">
        <ion-segment-button value="">All</ion-segment-button>
        <ion-segment-button value="submitted">Submitted</ion-segment-button>
        <ion-segment-button value="validated">Validated</ion-segment-button>
        <ion-segment-button value="tracked">Tracked</ion-segment-button>
        <ion-segment-button value="closed">Closed</ion-segment-button>
      </ion-segment>

      <!-- List of reports -->
      @if (reports.length > 0) {
        <ion-list class="ion-margin-top">
          @for (report of reports; track report.id) {
            <ion-item button (click)="openEditModal(report)">
              <ion-label>
                <h2>{{ report.title }}</h2>
                <p>{{ report.category_name }} · {{ report.priority || '—' }}</p>
                <p class="ion-text-sm ion-color-medium">
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
        <p class="ion-text-center ion-margin-top">No reports found.</p>
      }
    </ion-content>

    <!-- Edit modal -->
    <ion-modal [isOpen]="showEditModal" (didDismiss)="showEditModal = false">
      @if (editingReport) {
        <ion-header>
          <ion-toolbar>
            <ion-title>Edit Report #{{ editingReport.id }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="showEditModal = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <h3>{{ editingReport.title }}</h3>
          <p class="ion-color-medium">By {{ editingReport.created_by_name }} on {{ editingReport.created_at | date:'short' }}</p>

          @if (editingReport.description) {
            <p><strong>Description:</strong> {{ editingReport.description }}</p>
          }

          <ion-list>
            <ion-item>
              <ion-label>Category</ion-label>
              <ion-select [(ngModel)]="editForm.category_id">
                <ion-select-option [value]="null">None</ion-select-option>
                @for (cat of categories; track cat.id) {
                  <ion-select-option [value]="cat.id">{{ cat.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-label>Priority</ion-label>
              <ion-select [(ngModel)]="editForm.priority">
                <ion-select-option [value]="null">None</ion-select-option>
                <ion-select-option value="low">Low</ion-select-option>
                <ion-select-option value="medium">Medium</ion-select-option>
                <ion-select-option value="high">High</ion-select-option>
                <ion-select-option value="urgent">Urgent</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-label>Route to Personnel</ion-label>
              <ion-select [(ngModel)]="editForm.routed_to">
                <ion-select-option [value]="null">Unassigned</ion-select-option>
                @for (p of personnel; track p.id) {
                  <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
          </ion-list>

          <ion-button expand="block" class="ion-margin-top" [disabled]="saving" (click)="saveChanges()">
            {{ saving ? 'Saving...' : 'Save' }}
          </ion-button>
        </ion-content>
      }
    </ion-modal>
  `,
})
export class ManageReportsPage implements OnInit {
  private reportService = inject(ReportService);
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

  async loadReports() {
    try {
      this.reports = await this.reportService.getAllReports(this.selectedStatus || null);
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load reports.');
    }
  }

  async loadPersonnel() {
    try {
      this.personnel = await this.reportService.getPersonnel();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load personnel.');
    }
  }

    async loadCategories() {
    try {
      this.categories = [
        { id: 1, name: 'Facilities' },
        { id: 2, name: 'IT' },
        { id: 3, name: 'Classroom' },
        { id: 4, name: 'Administrative' },
      ];
    } catch {
      // empty
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
      await this.reportService.updateReport(this.editingReport.id, this.editForm);      await this.feedback.toast('Report updated.', 'success');
      this.showEditModal = false;
      await this.loadReports();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not save changes.');
    } finally {
      this.saving = false;
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