import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// How long we wait for a GPS fix before giving up. Lower is faster but may miss a fix indoors.
const GPS_TIMEOUT_MS = 10000;

// granted: we have coordinates. denied: the user said no. timeout: no fix in time.
// unavailable: this device or browser cannot give a location.
export type GpsStatus = 'granted' | 'denied' | 'timeout' | 'unavailable';

// camera = take a new photo. gallery = choose one that already exists.
export type PhotoSource = 'camera' | 'gallery';

export interface GpsResult {
  status: GpsStatus;
  latitude?: number;
  longitude?: number;
}

// Wraps the phone (native) and the browser (web) so pages do not care which one runs.
// getPosition never throws: every problem comes back as a status.
@Injectable({ providedIn: 'root' })
export class DeviceService {

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  // Asks for the location and returns a status plus coordinates when we have them.
  async getPosition(): Promise<GpsResult> {
    try {
      return this.isNative() ? await this.getPositionNative() : await this.getPositionWeb();
    } catch {
      return { status: 'unavailable' };
    }
  }

  // Phone: asks for permission first, then reads the GPS through the Capacitor plugin.
  private async getPositionNative(): Promise<GpsResult> {
    try {
      let permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        permission = await Geolocation.requestPermissions();
      }
      if (permission.location !== 'granted') {
        return { status: 'denied' };
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT_MS,
      });
      return {
        status: 'granted',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
    } catch (e: any) {
      const message = String(e?.message ?? '').toLowerCase();
      return { status: message.includes('timeout') ? 'timeout' : 'unavailable' };
    }
  }

  // Browser: uses the standard browser location API.
  // Browsers only allow it on a secure page (localhost or https). A plain http LAN address will fail here.
  private getPositionWeb(): Promise<GpsResult> {
    if (!window.isSecureContext || !navigator.geolocation) {
      return Promise.resolve({ status: 'unavailable' });
    }

    return new Promise<GpsResult>((resolve) => {
      // Safety net: if the browser never calls back, we still answer after the timeout.
      const safety = setTimeout(() => resolve({ status: 'timeout' }), GPS_TIMEOUT_MS + 2000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(safety);
          resolve({
            status: 'granted',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          clearTimeout(safety);
          // Error codes from the browser: 1 = denied, 2 = unavailable, 3 = timeout.
          const status: GpsStatus =
            err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
          resolve({ status });
        },
        { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 }
      );
    });
  }

  // Phone only: opens the app's camera (source 'camera') or photo gallery (source 'gallery').
  // Returns the photo as a data URL plus the time it came back. Returns null when the user cancels.
  // Throws a friendly Error for real failures. The page shows it in a toast.
  async pickPhotoNative(source: PhotoSource): Promise<{ dataUrl: string; takenAt: string } | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.dataUrl) {
        throw new Error('No photo was returned.');
      }
      // The moment the photo came back is the time we store.
      return { dataUrl: photo.dataUrl, takenAt: new Date().toISOString() };
    } catch (e: any) {
      const message = String(e?.message ?? '').toLowerCase();
      if (message.includes('cancel')) {
        return null;
      }
      throw new Error('Could not open the camera or gallery.');
    }
  }
}