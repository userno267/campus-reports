import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
  IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { CampusLocation, RequestCategory } from '../models/request.model';
import { NewRequestForm, RequestService } from '../services/request.service';
import { FeedbackService } from '../services/feedback.service';
import { resizeImageToBase64 } from '../utils/photo.util';

// Faculty form: title, category, location, description, and a before photo.
@Component({
  selector: 'app-new-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
    IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar,
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
          <ion-select label="Category" labelPlacement="floating" interface="action-sheet"
                      [(ngModel)]="categoryId">
            @for (c of categories; track c.id) {
              <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-select label="Location" labelPlacement="floating" interface="action-sheet"
                      [(ngModel)]="locationId">
            @for (l of locations; track l.id) {
              <ion-select-option [value]="l.id">{{ l.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-textarea label="Description" labelPlacement="floating"
                        [rows]="4" [counter]="true" maxlength="500"
                        [(ngModel)]="description"></ion-textarea>
        </ion-item>
      </ion-list>

      <!-- capture="environment" opens the back camera on a phone.
           On a computer it simply opens the file picker. -->
      <div class="photo-box ion-margin-top">
        <p class="photo-label">Before photo (required)</p>
        @if (photoPreview) {
          <img class="photo-preview" [src]="photoPreview" alt="Before photo preview" />
        }
        <input #photoInput type="file" accept="image/*" capture="environment" hidden
               (change)="onPhotoPicked($event)" />
        <ion-button expand="block" fill="outline" [disabled]="busy" (click)="photoInput.click()">
          {{ photoPreview ? 'Replace photo' : 'Take or choose photo' }}
        </ion-button>
      </div>

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy" (click)="submit()">
        {{ busy ? 'Working...' : 'Submit Report' }}
      </ion-button>
    </ion-content>
  `,
  styles: [`
    .photo-label {
      margin: 0 0 8px;
      font-weight: 600;
    }
    .photo-preview {
      display: block;
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 10px;
    }
  `],
})
export class NewReportPage implements OnInit {
  private requests = inject(RequestService);
  private feedback = inject(FeedbackService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  categories: RequestCategory[] = [];
  locations: CampusLocation[] = [];

  title = '';
  categoryId: number | null = null;
  locationId: number | null = null;
  description = '';
  photoBase64: string | null = null;   // raw base64, sent to the server
  photoPreview: string | null = null;  // data URL, only for the <img> preview
  busy = false;

  async ngOnInit() {
    try {
      // Load both dropdown lists at the same time.
      [this.categories, this.locations] = await Promise.all([
        this.requests.getCategories(),
        this.requests.getLocations(),
      ]);
      this.cdr.markForCheck();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load the form.');
    }
  }

  async onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the user pick the same photo again later
    if (!file) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.photoBase64 = await resizeImageToBase64(file);
      this.photoPreview = 'data:image/jpeg;base64,' + this.photoBase64;
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not read that photo.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  async submit() {
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const form: NewRequestForm = {
        title: this.title,
        category_id: this.categoryId,
        location_id: this.locationId,
        description: this.description,
        before_photo: this.photoBase64,
      };

      const id = await this.requests.submit(form);

      this.resetForm();
      await this.feedback.toast(`Request #${id} submitted.`, 'success');
      await this.router.navigateByUrl('/tabs/my-reports');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not submit the request.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private resetForm() {
    this.title = '';
    this.categoryId = null;
    this.locationId = null;
    this.description = '';
    this.photoBase64 = null;
    this.photoPreview = null;
  }
}