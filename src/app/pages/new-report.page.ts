import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
  IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { CampusLocation, RequestCategory } from '../models/request.model';
import { NewRequestForm, RequestService } from '../services/request.service';
import { FeedbackService } from '../services/feedback.service';
import { DeviceService, GpsStatus, PhotoSource } from '../services/device.service';
import { SearchablePickerComponent } from '../components/searchable-picker.component';
import {
  WORKING_QUALITY, resizeDataUrlToBase64, resizeImageToBase64, stampPhoto,
} from '../utils/photo.util';

// 'idle' = not asked yet, 'loading' = waiting for the device.
type GpsState = 'idle' | 'loading' | GpsStatus;

// Faculty form: title, category, location (both searchable), description, a before photo, and the device location.
@Component({
  selector: 'app-new-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonButton, IonContent, IonHeader, IonInput, IonItem, IonList,
    IonTextarea, IonTitle, IonToolbar,
    SearchablePickerComponent,
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

        <!-- Type to search. The list narrows as you type. Pick one from the list. -->
        <app-searchable-picker
          #categoryPicker
          label="Category"
          placeholder="Type to search, e.g. Electrical"
          [items]="categories"
          [selectedId]="categoryId"
          [disabled]="busy"
          (selectedChange)="categoryId = $event"
        />

        <!-- Type to search. If the room is not in the list, you can add it. -->
        <app-searchable-picker
          #locationPicker
          label="Location"
          placeholder="Type to search, e.g. Room 101"
          [items]="locations"
          [selectedId]="locationId"
          [allowCreate]="true"
          addNoun="location"
          [disabled]="busy || addingLocation"
          (selectedChange)="locationId = $event"
          (created)="addLocation($event)"
        />

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

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy || stamping" (click)="submit()">
        {{ busy ? 'Working...' : (stamping ? 'Adding stamp...' : 'Submit Report') }}
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
  @ViewChild('categoryPicker') categoryPicker?: SearchablePickerComponent;
  @ViewChild('locationPicker') locationPicker?: SearchablePickerComponent;

  categories: RequestCategory[] = [];
  locations: CampusLocation[] = [];

  title = '';
  categoryId: number | null = null;
  locationId: number | null = null;
  description = '';

  photoRaw: string | null = null;      // resized photo WITHOUT the stamp. The stamp is always drawn from this one.
  photoBase64: string | null = null;   // stamped photo, raw base64, sent to the server
  photoPreview: string | null = null;  // data URL of the stamped photo, only for the <img> preview
  photoTakenAt: string | null = null;  // ISO UTC time the photo was taken (or picked in the browser)

  // Feature 5: the stamp is redrawn when the GPS result changes. stampSeq makes sure
  // that only the newest drawing is kept if two of them overlap.
  stamping = false;
  private stampSeq = 0;

  gpsState: GpsState = 'idle';
  latitude: number | null = null;
  longitude: number | null = null;

  busy = false;
  addingLocation = false;

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
      // Load both lists at the same time.
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

  // Adds a location the faculty member typed that is not in the list yet.
  // The server returns the existing one if the name is already in use, so there are no duplicates.
  async addLocation(name: string) {
    if (this.addingLocation) return;
    this.addingLocation = true;
    this.cdr.markForCheck();
    try {
      const result = await this.requests.createLocation(name);
      const loc = result.location;
      if (!this.locations.some((l) => l.id === loc.id)) {
        this.locations = [...this.locations, loc].sort((a, b) => a.name.localeCompare(b.name));
      }
      this.locationId = loc.id;
      await this.feedback.toast(
        result.created
          ? `Added "${loc.name}" to the list.`
          : `"${loc.name}" is already in the list. Selected it.`,
        'success',
      );
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not add the location.');
    } finally {
      this.addingLocation = false;
      this.cdr.markForCheck();
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

    // The photo may already be chosen. Redraw its stamp with the new GPS result.
    await this.applyStamp();

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
      const base64 = await resizeDataUrlToBase64(pick.dataUrl, 1280, WORKING_QUALITY);
      await this.setPhoto(base64, pick.takenAt);
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
      const base64 = await resizeImageToBase64(file, 1280, WORKING_QUALITY);
      await this.setPhoto(base64, takenAt);
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not read that photo.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private async setPhoto(raw: string, takenAt: string) {
    this.photoRaw = raw;
    this.photoTakenAt = takenAt;
    await this.applyStamp();
  }

  // Feature 5: draws the stamp (coordinates and time) on the photo.
  // It always starts from photoRaw, so the strip is never added twice.
  // Called when a photo is chosen, and again when the GPS result changes.
  private async applyStamp() {
    const raw = this.photoRaw;
    if (!raw) return;

    const seq = ++this.stampSeq;
    this.stamping = true;
    this.cdr.markForCheck();
    try {
      const stamped = await stampPhoto(raw, this.photoTakenAt, this.latitude, this.longitude);
      if (seq !== this.stampSeq) return;   // a newer stamp is already running
      this.photoBase64 = stamped;
      this.photoPreview = 'data:image/jpeg;base64,' + stamped;
    } catch (e: any) {
      if (seq !== this.stampSeq) return;
      // Remove the photo, so a photo with a wrong or missing stamp is never sent.
      this.photoRaw = null;
      this.photoBase64 = null;
      this.photoPreview = null;
      this.photoTakenAt = null;
      await this.feedback.toast(e.message ?? 'Could not add the stamp. Please choose the photo again.');
    } finally {
      if (seq === this.stampSeq) {
        this.stamping = false;
      }
      this.cdr.markForCheck();
    }
  }

  async submit() {
    if (this.stamping) return;   // wait until the stamp is drawn
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
    // Empty the two search boxes too, so the old text does not stay on screen.
    this.categoryPicker?.clear();
    this.locationPicker?.clear();
    this.stampSeq++;              // cancels any stamp that is still being drawn
    this.stamping = false;
    this.photoRaw = null;
    this.photoBase64 = null;
    this.photoPreview = null;
    this.photoTakenAt = null;
    // The next visit asks for a fresh location, because the old one may be out of date.
    this.gpsState = 'idle';
    this.latitude = null;
    this.longitude = null;
  }
}