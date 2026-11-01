import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { describeFromTo } from '../utils/geo.util';

// A free map (Leaflet + OpenStreetMap). Shows the problem as a red dot and, when given,
// the viewer's own position as a blue dot. Both are drawn as circles, so no image files are needed.
// The staff position is an input only: this component never saves it.
@Component({
  selector: 'app-location-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map" #mapEl [hidden]="!hasProblem"></div>

    @if (hasProblem) {
      <p class="legend">
        <span class="dot problem"></span> Problem
        @if (hasStaff) {
          <span class="dot you"></span> You
        }
      </p>
      @if (hasStaff) {
        <p class="direction">The problem is {{ directionText }}.</p>
      }
    } @else {
      <p class="none">No location was recorded for this request.</p>
    }
  `,
  styles: [`
    .map {
      position: relative;
      z-index: 0;
      overflow: hidden;
      height: 240px;
      width: 100%;
      border-radius: 14px;
      border: 1px solid #e2e8dc;
      margin-top: 12px;
    }

    .legend {
      margin: 8px 0 0;
      color: #29483d;
      font-size: 13px;
    }

    .direction {
      margin: 4px 0 0;
      color: #29483d;
      font-weight: 600;
    }

    .none {
      margin: 12px 0 0;
      color: #87958a;
      font-size: 13px;
    }

    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin: 0 4px 0 10px;
      vertical-align: middle;
    }

    .dot.problem {
      background: #b5472e;
    }

    .dot.you {
      background: #2c6fb0;
    }
  `],
})
export class LocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() problemLat: number | null = null;
  @Input() problemLng: number | null = null;
  @Input() staffLat: number | null = null;
  @Input() staffLng: number | null = null;

  @ViewChild('mapEl') mapEl!: ElementRef<HTMLElement>;

  private map: L.Map | null = null;
  private layer: L.LayerGroup | null = null;

  get hasProblem(): boolean {
    return this.problemLat !== null && this.problemLng !== null;
  }

  get hasStaff(): boolean {
    return this.staffLat !== null && this.staffLng !== null;
  }

  get directionText(): string {
    if (!this.hasProblem || !this.hasStaff) return '';
    return describeFromTo(
      this.staffLat as number, this.staffLng as number,
      this.problemLat as number, this.problemLng as number
    );
  }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, { attributionControl: true });
    // OpenStreetMap is free. Its attribution must stay visible, so it is shown on the map.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);

    this.render();
    // The map may have been created while its box was still hidden. Measure it again once it is shown.
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges() {
    this.render();
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = null;
    this.layer = null;
  }

  // Redraws the pins and zooms so both are visible.
  private render() {
    if (!this.map || !this.layer) return;
    this.layer.clearLayers();

    if (!this.hasProblem) return;

    const problem: L.LatLngTuple = [this.problemLat as number, this.problemLng as number];
    L.circleMarker(problem, {
      radius: 9, color: '#ffffff', weight: 2, fillColor: '#b5472e', fillOpacity: 1,
    }).addTo(this.layer);

    if (this.hasStaff) {
      const you: L.LatLngTuple = [this.staffLat as number, this.staffLng as number];
      L.circleMarker(you, {
        radius: 7, color: '#ffffff', weight: 2, fillColor: '#2c6fb0', fillOpacity: 1,
      }).addTo(this.layer);
      this.map.fitBounds(L.latLngBounds([problem, you]).pad(0.3), { maxZoom: 18 });
    } else {
      this.map.setView(problem, 17);
    }
    this.map.invalidateSize();
  }
}