import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
  IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { Category } from '../models/report.model';
import { ReportService } from '../services/report.service';
import { FeedbackService } from '../services/feedback.service';
import { CategorySearchComponent } from '../components/category-search.component';

@Component({
  selector: 'app-new-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CategorySearchComponent,
    IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
    IonTextarea, IonTitle, IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          <app-category-search 
            [categories]="categories"
            (categorySelected)="onCategorySelected($event)">
          </app-category-search>
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
  private reportService = inject(ReportService);
  private feedback = inject(FeedbackService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  categories: Category[] = [];
  title = '';
  categoryId: number | null = null;
  description = '';
  busy = false;

  async ngOnInit() {
    try {
      this.categories = await this.reportService.getCategories();
      console.log('[NewReport] Loaded categories:', this.categories);
      this.cdr.markForCheck();
    } catch (e: any) {
      console.error('[NewReport] Error loading categories:', e);
      await this.feedback.toast('Could not load categories.');
    }
  }

  onCategorySelected(categoryId: number | null) {
    this.categoryId = categoryId;
  }

  async submit() {
    this.busy = true;
    try {
      const id = await this.reportService.submit({
        title: this.title,
        category_id: this.categoryId,
        description: this.description,
      });

      this.resetForm();
      await this.feedback.toast(`Report #${id} submitted.`, 'success');
      await this.router.navigateByUrl('/tabs/my-reports');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not submit the report.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private resetForm() {
    this.title = '';
    this.categoryId = null;
    this.description = '';
  }
}