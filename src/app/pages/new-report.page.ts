import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject,
} from '@angular/core';
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
import { DeviceService, GpsStatus, PhotoSource } from '../services/device.service';
import { resizeDataUrlToBase64, resizeImageToBase64 } from '../utils/photo.util';

// 'idle' = not asked yet, 'loading' = waiting for the device.
type GpsState = 'idle' | 'loading' | GpsStatus;

// Faculty form: title, category, location, description, a before photo, and the device location.
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

      <!-- Device location, shown as text. It is optional: the photo can still be sent without it. -->
      <div class="gps-box ion-margin-top">
        <p class="photo-label">Location (optional)</p>
        <p class="gps-text">{{ gpsText }}</p>
        <ion-button expand="block" fill="outline"
                    [disabled]="busy || gpsState === 'loading'" (click)="refreshLocation()">
          Try GPS again
        </ion-button>
      </div>

      <!-- Two separate buttons: take a new photo, or choose one that already exists. -->
      <div class="photo-box ion-margin-top">
        <p class="photo-label">Before photo (required)</p>
        @if (photoPreview) {
          <img class="photo-preview" [src]="photoPreview" alt="Before photo preview" />
        }
        <!-- In a phone browser, capture="environment" opens the back camera directly.
             The second input has no capture, so it opens the file or gallery picker. -->
        <input #cameraInput type="file" accept="image/*" capture="environment" hidden
               (change)="onPhotoPicked($event)" />
        <input #galleryInput type="file" accept="image/*" hidden
               (change)="onPhotoPicked($event)" />

        <ion-button expand="block" [disabled]="busy" (click)="openPhoto('camera')">
          Take photo
        </ion-button>
        <ion-button expand="block" fill="outline" [disabled]="busy" (click)="openPhoto('gallery')">
          Choose photo
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
    .gps-text {
      margin: 0 0 8px;
      color: #29483d;
    }
    .photo-preview {
      display: block;
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 10px;
    }
    .photo-box ion-button {
      margin-top: 8px;
    }
  `],
})
export class NewReportPage implements OnInit {
  private requests = inject(RequestService);
  private feedback = inject(FeedbackService);
  private device = inject(DeviceService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('cameraInput') cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('galleryInput') galleryInput?: ElementRef<HTMLInputElement>;

  categories: RequestCategory[] = [];
  locations: CampusLocation[] = [];

  title = '';
  categoryId: number | null = null;
  locationId: number | null = null;
  description = '';

  photoBase64: string | null = null;   // raw base64, sent to the server
  photoPreview: string | null = null;  // data URL, only for the <img> preview
  photoTakenAt: string | null = null;  // ISO UTC time the photo was taken (or picked in the browser)

  gpsState: GpsState = 'idle';
  latitude: number | null = null;
  longitude: number | null = null;

  busy = false;

  // The text shown under "Location". Kept in one place so every state reads the same.
  get gpsText(): string {
    switch (this.gpsState) {
      case 'granted':
        return this.latitude !== null && this.longitude !== null
          ? `${this.latitude.toFixed(5)}, ${this.longitude.toFixed(5)}`
          : 'Location not checked yet.';
      case 'loading':
        return 'Getting your location...';
      case 'denied':
        return 'Location permission is off. The photo can still be sent.';
      case 'timeout':
        return 'Location took too long. Try again.';
      case 'unavailable':
        return 'Location is not available. The photo can still be sent.';
      default:
        return 'Location not checked yet.';
    }
  }

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

  // Ask for the location once when the tab opens. Later visits keep the fix until the user refreshes it.
  async ionViewWillEnter() {
    if (this.gpsState === 'idle') {
      await this.refreshLocation(false);
    }
  }

  // Asks the device for a location. showMessage = true shows a toast when it fails.
  async refreshLocation(showMessage = true) {
    if (this.gpsState === 'loading') return;

    this.gpsState = 'loading';
    this.cdr.markForCheck();

    const result = await this.device.getPosition();
    this.gpsState = result.status;

    if (result.status === 'granted') {
      this.latitude = result.latitude ?? null;
      this.longitude = result.longitude ?? null;
    } else {
      this.latitude = null;
      this.longitude = null;
    }
    this.cdr.markForCheck();

    if (showMessage && result.status !== 'granted') {
      await this.feedback.toast(this.gpsText);
    }
  }

  // "Take photo" opens the camera. "Choose photo" opens the gallery or file picker.
  // On the phone app these are the native camera or gallery. In a browser they are the two file inputs.
  async openPhoto(source: PhotoSource) {
    if (this.device.isNative()) {
      await this.pickNative(source);
      return;
    }
    const input = source === 'camera' ? this.cameraInput?.nativeElement : this.galleryInput?.nativeElement;
    input?.click();
  }

  private async pickNative(source: PhotoSource) {
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const pick = await this.device.pickPhotoNative(source);
      if (!pick) return;   // the user cancelled
      const base64 = await resizeDataUrlToBase64(pick.dataUrl);
      this.setPhoto(base64, pick.takenAt);
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not add the photo.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // Browser only: a file was picked from either input. The time is when it was picked,
  // because a browser file has no camera time.
  async onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the user pick the same photo again later
    if (!file) return;

    const takenAt = new Date().toISOString();
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const base64 = await resizeImageToBase64(file);
      this.setPhoto(base64, takenAt);
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not read that photo.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private setPhoto(base64: string, takenAt: string) {
    this.photoBase64 = base64;
    this.photoPreview = 'data:image/jpeg;base64,' + base64;
    this.photoTakenAt = takenAt;
    this.cdr.markForCheck();
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
        latitude: this.latitude,
        longitude: this.longitude,
        photo_taken_at: this.photoTakenAt,
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
    this.photoTakenAt = null;
    // The next visit asks for a fresh location, because the old one may be out of date.
    this.gpsState = 'idle';
    this.latitude = null;
    this.longitude = null;
  }
}