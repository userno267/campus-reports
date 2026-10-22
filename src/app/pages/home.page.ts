import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem,
  IonList, IonListHeader, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { Category } from '../models/report.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonItem, IonList, IonListHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
<ion-title>Account</ion-title>        <ion-buttons slot="end"><ion-button (click)="logout()">Logout</ion-button></ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <h2>Welcome, {{ auth.user()?.name }}</h2>
      <p>Role: <strong>{{ auth.user()?.role }}</strong></p>

      <ion-list>
        <ion-list-header>Categories (read from SQLite)</ion-list-header>
        @for (c of categories; track c.id) {
          <ion-item>{{ c.name }}</ion-item>
        } @empty {
          <ion-item>No categories found.</ion-item>
        }
      </ion-list>
    </ion-content>
  `,
})
export class HomePage implements OnInit {
  auth = inject(AuthService);
  private db = inject(DatabaseService);
  private router = inject(Router);

  categories: Category[] = [];

  async ngOnInit() {
    this.categories = await this.db.getCategories();
  }

  async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}