import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
  IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { Category } from '../models/report.model';
import { DatabaseService } from '../services/database.service';
import { FeedbackService } from '../services/feedback.service';
import { ReportService } from '../services/report.service';

@Component({
  selector: 'app-new-report',
  standalone: true,
  imports: [
    FormsModule, IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
    IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>New Report</ion-title></ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input label="Title (e.g. Projector not working)" labelPlacement="floating"
                     maxlength="80" [(ngModel)]="title"></ion-input>
        </ion-item>

        <ion-item>
          <ion-select label="Category" labelPlacement="floating" [(ngModel)]="categoryId">
            @for (c of categories; track c.id) {
              <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-textarea label="Description (optional)" labelPlacement="floating"
                        [rows]="4" [counter]="true" maxlength="500"
                        [(ngModel)]="description"></ion-textarea>
        </ion-item>
      </ion-list>

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy" (click)="submit()">
        Submit Report
      </ion-button>
    </ion-content>
  `,
})
export class NewReportPage implements OnInit {
  private db = inject(DatabaseService);
  private reports = inject(ReportService);
  private feedback = inject(FeedbackService);
  private router = inject(Router);

  categories: Category[] = [];

  // Form fields
  title = '';
  categoryId: number | null = null;
  description = '';
  busy = false; // stops double-taps from submitting twice

  async ngOnInit() {
    try {
      this.categories = await this.db.getCategories();
    } catch {
      await this.feedback.toast('Could not load categories.');
    }
  }

  async submit() {
    this.busy = true;
    try {
      const id = await this.reports.submit({
        title: this.title,
        category_id: this.categoryId,
        description: this.description,
      });

      this.resetForm(); // Ionic keeps tab pages alive, so clear the form ourselves
      await this.feedback.toast(`Report #${id} submitted.`, 'success');
      await this.router.navigateByUrl('/tabs/my-reports');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not submit the report.');
    } finally {
      this.busy = false;
    }
  }

  private resetForm() {
    this.title = '';
    this.categoryId = null;
    this.description = '';
  }
}