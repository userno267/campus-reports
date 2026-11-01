import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

// Faculty landing tab: welcome text and two shortcuts. No data is loaded here.
@Component({
  selector: 'app-faculty-home',
  standalone: true,
  imports: [RouterLink, IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>Home</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      <div class="welcome-card">
        <p class="welcome-title">Welcome, {{ auth.user()?.name }}</p>
        <p class="welcome-text">
          Report a campus facility problem, or check on the reports you have already sent.
        </p>

        <div class="actions">
          <ion-button expand="block" routerLink="/tabs/new-report">New Report</ion-button>
          <ion-button expand="block" fill="outline" routerLink="/tabs/my-reports">My Reports</ion-button>
        </div>
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

    .welcome-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .welcome-title {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #29483d;
    }

    .welcome-text {
      margin: 0 0 16px;
      color: #87958a;
    }

    .actions {
      display: grid;
      gap: 10px;
    }

    ion-button {
      --background: #29483d;
      --color: #fbfaf5;
      --border-radius: 12px;
    }

    ion-button[fill='outline'] {
      --background: transparent;
      --color: #29483d;
      --border-color: #29483d;
    }
  `],
})
export class FacultyHomePage {
  auth = inject(AuthService);
}