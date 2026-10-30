import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonList, IonListHeader, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { RequestService } from '../services/request.service';
import { FeedbackService } from '../services/feedback.service';
import { RequestCategory } from '../models/request.model';

// The Account tab: shows who is logged in, their role, and the category list.
// Categories are read from the PHP API (PostgreSQL), the same source as the requests.
// Why RequestService: the old ReportService is being retired (Step 10), and
// RequestService is the service the request screens already use.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonItem, IonList, IonListHeader, IonTitle, IonToolbar],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="page-toolbar">
        <ion-title>Account</ion-title>
        <ion-buttons slot="end">
          <ion-button class="logout-btn" (click)="logout()">Logout</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-content">
      <div class="profile-card">
        <h2 class="welcome">Welcome, {{ auth.user()?.name }}</h2>
        <p class="role-line">
          Role: <span class="role-chip">{{ auth.user()?.role }}</span>
        </p>
      </div>

      <ion-list class="card-list ion-margin-top">
        <ion-list-header class="list-header">Categories</ion-list-header>
        @for (c of categories; track c.id) {
          <ion-item detail="false">{{ c.name }}</ion-item>
        } @empty {
          <ion-item detail="false">No categories found.</ion-item>
        }
      </ion-list>
    </ion-content>
  `,
  styles: [`
    /* Same palette as tabs.page.ts, placeholder.page.ts, and manage-reports.page.ts */
    .page-content {
      --background: #f6f5ee;
    }

    .page-toolbar {
      --background: #fbfaf5;
      --color: #29483d;
      border-bottom: 1px solid #e2e8dc;
    }

    .logout-btn {
      --color: #29483d;
      font-weight: 600;
      text-transform: none;
    }

    /* Welcome card */
    .profile-card {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .welcome {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 700;
      color: #29483d;
    }

    .role-line {
      margin: 0;
      color: #87958a;
    }

    /* Small pill that shows the role */
    .role-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      background: #e8efe3;
      color: #29483d;
      font-weight: 700;
      text-transform: capitalize;
    }

    /* Category card with thin dividers */
    .card-list {
      background: #fbfaf5;
      border: 1px solid #e2e8dc;
      border-radius: 14px;
      overflow: hidden;
      padding: 0;
      box-shadow: 0 4px 14px rgba(32, 59, 53, 0.05);
    }

    .card-list ion-item {
      --background: #fbfaf5;
      --border-color: #e2e8dc;
      --color: #29483d;
    }

    .list-header {
      color: #87958a;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      background: #fbfaf5;
    }
  `],
})
export class HomePage implements OnInit {
  auth = inject(AuthService);
  private requestService = inject(RequestService);
  private feedback = inject(FeedbackService);
  private router = inject(Router);

  categories: RequestCategory[] = [];

  async ngOnInit() {
    try {
      this.categories = await this.requestService.getCategories();
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load categories.');
    }
  }

  async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}