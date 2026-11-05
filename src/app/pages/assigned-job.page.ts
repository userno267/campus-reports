import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonList, IonTextarea, IonTitle, IonToolbar,
} from '@ionic/angular';
import { RequestStatus, StaffJob } from '../models/request.model';
import { StaffJobService } from '../services/staff-job.service';
import { FeedbackService } from '../services/feedback.service';
import { LiveUpdateService, LiveWatcher } from '../services/live-update.service';
import { DeviceService, GpsStatus, PhotoSource } from '../services/device.service';
import {
  WORKING_QUALITY, resizeDataUrlToBase64, resizeImageToBase64, stampPhoto,
} from '../utils/photo.util';
import { PriorityBadgeComponent } from '../components/priority-badge.component';
import { LocationMapComponent } from '../components/location-map.component';

// Staff-facing labels and badge colours for each status.
const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  assigned: 'Not started',
  in_progress: 'In progress',
  awaiting_proof: 'Waiting for review',
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

// 'idle' = no fix asked yet, 'loading' = waiting for the device.
type GpsState = 'idle' | 'loading' | GpsStatus;

// "Assigned" tab for staff. Shows the one active job and walks through three steps:
// assigned -> started -> proof sent (awaiting admin review).
// Why no separate detail page: the job is always the same single item.
@Component({
  selector: 'app-assigned-job',
  standalone: true,
  imports: [
    DatePipe, FormsModule,
    IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem,
    IonList, IonTextarea, IonTitle, IonToolbar,
    PriorityBadgeComponent, LocationMapComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>My Job</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="load()" [disabled]="loading || busy">Refresh</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      @if (job) {
        <!-- The job itself -->
        <div class="job-card">
          <div class="job-head">
            <h2 class="job-title">{{ job.title }}</h2>
            <div class="badges">
              <app-priority-badge [priority]="job.priority" />
              <ion-badge [color]="statusColor(job.status)">{{ statusLabel(job.status) }}</ion-badge>
            </div>
          </div>
          <p class="meta">
            {{ job.category_name }} · {{ job.location_name }} ·
            Updated {{ job.updated_at | date: 'medium' }}
          </p>
          <p class="detail-text">{{ job.description }}</p>
          <p class="meta"><strong>Problem location:</strong> {{ formatCoords(job.latitude, job.longitude) }}</p>
          <img class="photo"
               [src]="'data:image/jpeg;base64,' + job.before_photo"
               alt="Problem photo" />

          <!-- Map to the problem (free: Leaflet + OpenStreetMap). Only while the job is still open. -->
          @if (job.status === 'assigned' || job.status === 'in_progress') {
            <app-location-map [problemLat]="job.latitude" [problemLng]="job.longitude"
                              [staffLat]="staffLat" [staffLng]="staffLng" />
            <p class="gps-text">{{ staffGpsText }}</p>
            <p class="meta">Your position is shown on this screen only. It is not saved.</p>
            <ion-button expand="block" fill="outline" class="action-btn-outline"
                        [disabled]="busy || staffGpsState === 'loading'" (click)="updateMyPosition()">
              Update my position
            </ion-button>
            @if (job.latitude !== null && job.longitude !== null) {
              <p class="meta">
                <a class="osm-link" target="_blank" rel="noopener"
                   [href]="openMapLink(job.latitude, job.longitude)">Open in a larger map</a>
              </p>
            }
          }
        </div>

        <!-- Step 1: assigned, not started yet -->
        @if (job.status === 'assigned') {
          <ion-button expand="block" class="action-btn ion-margin-top"
                      [disabled]="busy" (click)="startJob()">
            {{ busy ? 'Saving...' : 'Mark as started' }}
          </ion-button>
        }

        <!-- Step 2: in progress, send proof of the finished work -->
        @if (job.status === 'in_progress') {
          <div class="job-card ion-margin-top">
            @if (job.rejected_remark) {
              <div class="rejected-card">
                <strong>Sent back by the admin:</strong>
                <p class="detail-text">{{ job.rejected_remark }}</p>
                <p class="meta">Please fix this and send proof again.</p>
              </div>
            }

            <h3 class="section-title">Proof of completed work</h3>
            <p class="meta">Take a photo of the finished work, add an optional note, then send it to the admin.</p>

            <!-- Two separate buttons: take a new photo, or choose one that already exists. -->
            <input #cameraInput type="file" accept="image/*" capture="environment" hidden
                   (change)="onPhotoPicked($event)" />
            <input #galleryInput type="file" accept="image/*" hidden
                   (change)="onPhotoPicked($event)" />

            <div class="photo-buttons">
              <ion-button expand="block" class="action-btn" [disabled]="busy" (click)="openPhoto('camera')">
                Take photo
              </ion-button>
              <ion-button expand="block" fill="outline" class="action-btn-outline"
                          [disabled]="busy" (click)="openPhoto('gallery')">
                Choose photo
              </ion-button>
            </div>

            @if (previewSrc) {
              <img class="photo" [src]="previewSrc" alt="After photo preview" />
              <p class="meta">Photo time: {{ proofTakenAt | date: 'medium' }}</p>
            }

            <!-- The proof needs a location. It is fixed when the photo is picked. -->
            <div class="gps-box">
              <p class="gps-label">Location of this proof (required)</p>
              <p class="gps-text">{{ gpsText }}</p>
              <ion-button expand="block" fill="outline" class="action-btn-outline"
                          [disabled]="busy || gpsState === 'loading'" (click)="fixLocation()">
                Try GPS again
              </ion-button>
            </div>

            <ion-list class="note-list">
              <ion-item>
                <ion-textarea label="Note (optional)" labelPlacement="stacked" [autoGrow]="true"
                              maxlength="300" placeholder="For example: replaced the filter"
                              [(ngModel)]="note"></ion-textarea>
              </ion-item>
            </ion-list>

            <ion-button expand="block" class="action-btn ion-margin-top"
                        [disabled]="!canSendProof()" (click)="submitProof()">
              {{ busy ? 'Sending...' : 'Send proof' }}
            </ion-button>
          </div>
        }

        <!-- Step 3: proof sent, waiting for the admin -->
        @if (job.status === 'awaiting_proof') {
          <div class="job-card ion-margin-top">
            <h3 class="section-title">Proof sent</h3>
            <p class="meta">Waiting for the admin to review your work.</p>
            @if (job.after_photo) {
              <img class="photo"
                   [src]="'data:image/jpeg;base64,' + job.after_photo"
                   alt="Your after photo" />
            }
            <p class="meta">
              <strong>Taken at:</strong> {{ job.after_photo_taken_at | date: 'medium' }} ·
              <strong>Location:</strong> {{ formatCoords(job.after_latitude, job.after_longitude) }}
            </p>
            @if (job.proof_note) {
              <p class="detail-text"><strong>Your note:</strong> {{ job.proof_note }}</p>
            }
          </div>
        }
      } @else if (!loading) {
        <div class="empty-card">
          No active job right now. New jobs appear here when the admin assigns you one.
        </div>
      }
    </ion-content>
  `,
  styles: [`
    /* Same palette as the other pages */
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    .job-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .job-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .job-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .section-title {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #29483d;
    }

    .detail-text {
      color: #29483d;
      margin: 8px 0;
    }

    .meta {
      color: #87958a;
      font-size: 13px;
      margin: 0 0 4px;
    }

    .osm-link {
      color: #29483d;
      font-weight: 600;
    }

    .photo {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
    }

    .photo-buttons {
      margin: 12px 0;
    }

    .photo-buttons ion-button {
      margin-top: 8px;
    }

    .gps-box {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      background: #f6f5ee;
    }

    .gps-label {
      margin: 0 0 6px;
      font-weight: 600;
      color: #29483d;
    }

    .gps-text {
      margin: 8px 0;
      color: #29483d;
    }

    .note-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      margin-top: 12px;
    }

    .note-list ion-item {
      --background: #fbfaf5;
      --color: #29483d;
    }

    .rejected-card {
      background: #fdf5e6;
      border: 1px solid #e9d3a6;
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 12px;
      color: #7a5a12;
    }

    .empty-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      color: #87958a;
      text-align: center;
    }

    .action-btn {
      --background: #29483d;
      --background-activated: #1f382f;
      --color: #fbfaf5;
      --border-radius: 14px;
      font-weight: 700;
      text-transform: none;
    }

    .action-btn-outline {
      --color: #29483d;
      --border-color: #29483d;
      --border-radius: 14px;
      font-weight: 700;
      text-transform: none;
    }
  `],
})
export class AssignedJobPage implements OnDestroy {
  private jobService = inject(StaffJobService);
  private feedback = inject(FeedbackService);
  private device = inject(DeviceService);
  private cdr = inject(ChangeDetectorRef);
  private live = inject(LiveUpdateService);
  private watcher: LiveWatcher | null = null;

  @ViewChild('cameraInput') cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('galleryInput') galleryInput?: ElementRef<HTMLInputElement>;

  job: StaffJob | null = null;
  loading = false;
  busy = false;

  // The proof the staff member is preparing. Cleared after it is sent.
  afterPhotoRaw: string | null = null; // resized photo WITHOUT the stamp. The stamp is always drawn from this one.
  afterPhoto: string | null = null;    // stamped photo, raw base64 for the API
  previewSrc: string | null = null;    // data URL of the stamped photo, for the preview image
  proofTakenAt: string | null = null;  // ISO UTC: when the photo was taken (or picked in the browser)
  note = '';

  // The proof's location, captured when the photo is picked.
  gpsState: GpsState = 'idle';
  proofLatitude: number | null = null;
  proofLongitude: number | null = null;

  // Feature 5: the stamp is redrawn when the GPS result changes. stampSeq makes sure
  // that only the newest drawing is kept if two of them overlap.
  stamping = false;
  private stampSeq = 0;

  // The staff member's own position, used only to draw the map and the distance.
  // It lives in memory on this screen. It is never sent to the server or saved.
  staffGpsState: GpsState = 'idle';
  staffLat: number | null = null;
  staffLng: number | null = null;

  // Ionic keeps tab pages alive, so start watching each time the tab is shown.
  // The job loads now, and again by itself whenever it changes (a new assignment, a job sent back,
  // a cancel). The proof photo, note and location being prepared are never cleared by a refresh
  // of the same job.
  ionViewWillEnter() {
    this.watcher?.stop();
    this.watcher = this.live.watch('job', (silent) => this.load(silent));
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
    if (!silent) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    try {
      const job = await this.jobService.loadCurrent();
      const changed = job?.id !== this.job?.id;
      // A different job means the old photo, note, location and staff position do not belong to it.
      if (changed) {
        this.clearProof();
        this.clearStaffPosition();
      }
      this.job = job;
      // Show the staff member where they are, once, for a new open job.
      if (changed && job && job.latitude !== null && (job.status === 'assigned' || job.status === 'in_progress')) {
        void this.updateMyPosition();
      }
    } catch (e: any) {
      if (!silent) {
        await this.feedback.toast(e.message ?? 'Could not load your job.');
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async startJob() {
    if (!this.job) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.job = await this.jobService.start(this.job.id);
      await this.feedback.toast('Job started.', 'success');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not start the job.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // Send is allowed only with a photo and a location fix.
  canSendProof(): boolean {
    return !this.busy && !this.stamping && this.gpsState !== 'loading'
      && this.afterPhoto !== null && this.proofLatitude !== null && this.proofLongitude !== null;
  }

  // The text shown under "Location of this proof".
  get gpsText(): string {
    switch (this.gpsState) {
      case 'granted':
        return this.proofLatitude !== null && this.proofLongitude !== null
          ? `${this.proofLatitude.toFixed(5)}, ${this.proofLongitude.toFixed(5)}`
          : 'Location not checked yet.';
      case 'loading':
        return 'Getting your location...';
      case 'denied':
        return 'Location permission is off. Turn it on, then tap Try GPS again. Proof needs your location.';
      case 'timeout':
        return 'Location took too long. Tap Try GPS again.';
      case 'unavailable':
        return 'Location is not available here. Proof needs your location.';
      default:
        return 'Take a photo to get the location.';
    }
  }

  // The text shown under the map for the staff member's own position.
  get staffGpsText(): string {
    switch (this.staffGpsState) {
      case 'granted':
        return this.staffLat !== null ? 'Your position is on the map.' : 'Position not checked yet.';
      case 'loading':
        return 'Getting your position...';
      case 'denied':
        return 'Location is off. Turn it on to see how far the problem is.';
      case 'timeout':
        return 'Your position took too long. Tap Update my position.';
      case 'unavailable':
        return 'Your position is not available here.';
      default:
        return 'Tap Update my position to see how far the problem is.';
    }
  }

  // Asks for the staff member's position, for the map only. Not saved anywhere.
  async updateMyPosition() {
    if (this.staffGpsState === 'loading') return;

    this.staffGpsState = 'loading';
    this.cdr.markForCheck();

    const result = await this.device.getPosition();
    this.staffGpsState = result.status;

    if (result.status === 'granted') {
      this.staffLat = result.latitude ?? null;
      this.staffLng = result.longitude ?? null;
    } else {
      this.staffLat = null;
      this.staffLng = null;
    }
    this.cdr.markForCheck();
  }

  // Ask the device for the location of the proof. Called when a photo is picked, and by the Try again button.
  async fixLocation() {
    if (this.gpsState === 'loading') return;

    this.gpsState = 'loading';
    this.cdr.markForCheck();

    const result = await this.device.getPosition();
    this.gpsState = result.status;

    if (result.status === 'granted') {
      this.proofLatitude = result.latitude ?? null;
      this.proofLongitude = result.longitude ?? null;
    } else {
      this.proofLatitude = null;
      this.proofLongitude = null;
    }
    this.cdr.markForCheck();

    // Redraw the stamp of the chosen photo with the new GPS result.
    await this.applyStamp();

    if (result.status !== 'granted') {
      await this.feedback.toast(this.gpsText);
    }
  }

  // Feature 5: draws the stamp (coordinates and time) on the proof photo.
  // It always starts from afterPhotoRaw, so the strip is never added twice.
  private async applyStamp() {
    const raw = this.afterPhotoRaw;
    if (!raw) return;

    const seq = ++this.stampSeq;
    this.stamping = true;
    this.cdr.markForCheck();
    try {
      const stamped = await stampPhoto(raw, this.proofTakenAt, this.proofLatitude, this.proofLongitude);
      if (seq !== this.stampSeq) return;   // a newer stamp is already running
      this.afterPhoto = stamped;
      this.previewSrc = 'data:image/jpeg;base64,' + stamped;
    } catch (e: any) {
      if (seq !== this.stampSeq) return;
      // Remove the photo, so a photo with a wrong or missing stamp is never sent.
      this.afterPhotoRaw = null;
      this.afterPhoto = null;
      this.previewSrc = null;
      this.proofTakenAt = null;
      await this.feedback.toast(e.message ?? 'Could not add the stamp. Please choose the photo again.');
    } finally {
      if (seq === this.stampSeq) {
        this.stamping = false;
      }
      this.cdr.markForCheck();
    }
  }

  // Shows "lat, lng" for a stored pair, or a short note when none was recorded.
  formatCoords(lat: number | null, lng: number | null): string {
    if (lat === null || lng === null) return 'Not recorded';
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  // A free link to a larger OpenStreetMap view of the problem location.
  openMapLink(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
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
      this.afterPhotoRaw = await resizeDataUrlToBase64(pick.dataUrl, 1280, WORKING_QUALITY);
      this.proofTakenAt = pick.takenAt;
      await this.applyStamp();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not read that photo. Please try again.');
      return;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
    // Get the location for this photo. Runs after the photo is shown, so the screen does not wait.
    // If the stamp failed, the photo was removed and there is nothing to locate.
    if (this.afterPhotoRaw) {
      void this.fixLocation();
    }
  }

  // Browser only: resize the picked file first, so the upload stays small.
  // The time is when the file was picked, because a browser file has no camera time.
  async onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.afterPhotoRaw = await resizeImageToBase64(file, 1280, WORKING_QUALITY);
      this.proofTakenAt = new Date().toISOString();
      await this.applyStamp();
    } catch (e: any) {
      await this.feedback.toast('Could not read that photo. Please try again.');
      return;
    } finally {
      // Clear the input so picking the same photo again still fires the change event.
      input.value = '';
      this.busy = false;
      this.cdr.markForCheck();
    }
    if (this.afterPhotoRaw) {
      void this.fixLocation();
    }
  }

  async submitProof() {
    if (!this.job) return;

    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.job = await this.jobService.submitProof(this.job.id, this.afterPhoto, this.note, {
        latitude: this.proofLatitude,
        longitude: this.proofLongitude,
        takenAt: this.proofTakenAt,
      });
      this.clearProof();
      await this.feedback.toast('Proof sent to the admin.', 'success');
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not send the proof.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private clearProof() {
    this.stampSeq++;              // cancels any stamp that is still being drawn
    this.stamping = false;
    this.afterPhotoRaw = null;
    this.afterPhoto = null;
    this.previewSrc = null;
    this.proofTakenAt = null;
    this.note = '';
    this.gpsState = 'idle';
    this.proofLatitude = null;
    this.proofLongitude = null;
  }

  private clearStaffPosition() {
    this.staffGpsState = 'idle';
    this.staffLat = null;
    this.staffLng = null;
  }

  statusLabel(status: RequestStatus): string {
    return STATUS_LABELS[status];
  }

  statusColor(status: RequestStatus): string {
    return STATUS_COLORS[status];
  }
}