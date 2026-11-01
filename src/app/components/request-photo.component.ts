import { Component, computed, input } from '@angular/core';

// The ONE place that shows a request photo in the app.
// Today the photo is raw base64 text from Postgres. Feature 6 (Cloudinary) changes only
// this file, so the image comes from a URL instead of base64.
@Component({
  selector: 'app-request-photo',
  standalone: true,
  template: `<img class="photo" [src]="src()" [alt]="alt()" />`,
  styles: [`
    .photo {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
    }
  `],
})
export class RequestPhotoComponent {
  // Raw base64, with no "data:" prefix, exactly as the API sends it today.
  base64 = input.required<string>();
  alt = input('Request photo');

  // Builds the image source in one place.
  protected readonly src = computed(() => 'data:image/jpeg;base64,' + this.base64());
}