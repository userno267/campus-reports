import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

// Temporary stand-in for tabs we haven't built yet.
// The title comes from the route's `data`, so one file serves every tab.
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      <div class="placeholder-card">
        <p class="placeholder-title">{{ title }}</p>
        <p class="placeholder-text">Coming in a later feature.</p>
        <p class="placeholder-user">
          Logged in as {{ auth.user()?.name }} ({{ auth.user()?.role }})
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    /* Same palette as the tab bar in tabs.page.ts */
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    .placeholder-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .placeholder-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .placeholder-text {
      margin: 0 0 10px;
      color: #87958a;
    }

    .placeholder-user {
      margin: 0;
      font-size: 13px;
      color: #29483d;
    }
  `],
})
export class PlaceholderPage {
  auth = inject(AuthService);
  title: string = inject(ActivatedRoute).snapshot.data['title'] ?? 'Coming soon';
}