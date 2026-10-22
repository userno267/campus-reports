import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader,
  IonInput, IonItem, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { FeedbackService } from '../services/feedback.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    FormsModule, RouterLink, IonBackButton, IonButton, IonButtons, IonContent,
    IonHeader, IonInput, IonItem, IonList, IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/login"></ion-back-button></ion-buttons>
        <ion-title>Create Faculty Account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input label="Full name" labelPlacement="floating" [(ngModel)]="name"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Email" labelPlacement="floating" type="email" [(ngModel)]="email"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Password (6+ characters)" labelPlacement="floating" type="password"
                     [(ngModel)]="password"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Confirm password" labelPlacement="floating" type="password"
                     [(ngModel)]="confirm"></ion-input>
        </ion-item>
      </ion-list>

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy" (click)="register()">
        Register
      </ion-button>
    </ion-content>
  `,
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private feedback = inject(FeedbackService);

  name = '';
  email = '';
  password = '';
  confirm = '';
  busy = false;

  async register() {
    if (this.password !== this.confirm) {
      await this.feedback.toast('Passwords do not match.');
      return;
    }
    this.busy = true;
    try {
      await this.auth.register(this.name, this.email, this.password);
      await this.feedback.toast('Account created. Welcome!', 'success');
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Registration failed.');
    } finally {
      this.busy = false;
    }
  }
}