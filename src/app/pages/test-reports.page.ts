import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton } from '@ionic/angular';
import { DatabaseService } from '../services/database.service';

@Component({
  selector: 'app-test-reports',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Test: All Reports</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-button expand="block" (click)="loadReports()">Reload Reports</ion-button>
      <ion-button expand="block" color="danger" (click)="clearDB()">Clear Database</ion-button>

      <h2 class="ion-margin-top">Reports in Database ({{ reports.length }})</h2>
      @if (reports.length > 0) {
        <ion-list>
          @for (r of reports; track r.id) {
            <ion-item>
              <ion-label>
                <h3>#{{ r.id }}: {{ r.title }}</h3>
                <p>Status: {{ r.status }} | Category: {{ r.category_name }}</p>
                <p class="ion-text-sm">Created: {{ r.created_at }}</p>
              </ion-label>
            </ion-item>
          }
        </ion-list>
      } @else {
        <p class="ion-color-medium">No reports found in database.</p>
      }
    </ion-content>
  `,
})
export class TestReportsPage implements OnInit {
  private db = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);
  reports: any[] = [];

  async ngOnInit() {
    await this.db.ready;
    await this.loadReports();
  }

  async loadReports() {
    try {
      this.reports = await (this.db as any).getAllReports(null);
      console.log('Test page loaded', this.reports.length, 'reports');
      this.cdr.markForCheck(); // Tell Angular to update the view
    } catch (e: any) {
      console.error('Error loading reports:', e);
    }
  }

  async clearDB() {
    if (confirm('Really clear all data?')) {
      const request = indexedDB.deleteDatabase('jeepSqliteStore');
      request.onsuccess = () => {
        console.log('Database cleared');
        window.location.reload();
      };
    }
  }
}