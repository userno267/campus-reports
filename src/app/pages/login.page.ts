import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { FeedbackService } from '../services/feedback.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar><ion-title>Campus Reports - Login</ion-title></ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input label="Email" labelPlacement="floating" type="email"
                     [(ngModel)]="email"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Password" labelPlacement="floating" type="password"
                     [(ngModel)]="password" (keyup.enter)="login()"></ion-input>
        </ion-item>
      </ion-list>

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy" (click)="login()">
        Log in
      </ion-button>
      <ion-button expand="block" fill="clear" routerLink="/register">
        New faculty? Create an account
      </ion-button>
    </ion-content>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private feedback = inject(FeedbackService);

  email = '';
  password = '';
  busy = false;

  async login() {
    this.busy = true;
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Login failed.');
    } finally {
      this.busy = false;
    }
  }
}