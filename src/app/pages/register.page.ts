import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem,
  IonList, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption,
  IonTitle, IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { FeedbackService } from '../services/feedback.service';
import { Department } from '../models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    FormsModule, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput,
    IonItem, IonList, IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption,
    IonTitle, IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/login"></ion-back-button></ion-buttons>
        <ion-title>Create Account</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Admin is never offered: admin accounts are seeded only. -->
      <ion-segment [value]="role()" (ionChange)="onRoleChange($event.detail.value)">
        <ion-segment-button value="faculty"><ion-label>Faculty</ion-label></ion-segment-button>
        <ion-segment-button value="staff"><ion-label>Staff</ion-label></ion-segment-button>
      </ion-segment>

      <ion-list class="ion-margin-top">
        <ion-item>
          <ion-input label="Full name" labelPlacement="floating" [(ngModel)]="name"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Email" labelPlacement="floating" type="email" [(ngModel)]="email"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Employee ID" labelPlacement="floating" [(ngModel)]="employeeId"></ion-input>
        </ion-item>

        <!-- Only staff belong to a department. -->
        @if (role() === 'staff') {
          <ion-item>
            <ion-select label="Department" labelPlacement="floating" placeholder="Choose one"
                        [(ngModel)]="departmentId">
              @for (d of departments(); track d.id) {
                <ion-select-option [value]="d.id">{{ d.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        }

        <ion-item>
          <ion-input label="Password (6+ characters)" labelPlacement="floating" type="password"
                     [(ngModel)]="password"></ion-input>
        </ion-item>
        <ion-item>
          <ion-input label="Confirm password" labelPlacement="floating" type="password"
                     [(ngModel)]="confirm"></ion-input>
        </ion-item>
      </ion-list>

      <ion-button expand="block" class="ion-margin-top" [disabled]="busy()" (click)="register()">
        Register
      </ion-button>
    </ion-content>
  `,
})
export class RegisterPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private feedback = inject(FeedbackService);

  // The app has no zone.js, so values that change AFTER an async call (or that the
  // template reads with @if) are signals. Plain text fields can stay normal properties.
  role = signal<'faculty' | 'staff'>('faculty');
  departments = signal<Department[]>([]);
  busy = signal(false);

  name = '';
  email = '';
  employeeId = '';
  departmentId: number | null = null;
  password = '';
  confirm = '';

  async ngOnInit() {
    try {
      this.departments.set(await this.auth.getDepartments());
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Could not load departments.');
    }
  }

  onRoleChange(value: string | number | undefined) {
    this.role.set(value === 'staff' ? 'staff' : 'faculty');
    if (this.role() === 'faculty') this.departmentId = null; // faculty have no department
  }

  async register() {
    if (this.password !== this.confirm) {
      await this.feedback.toast('Passwords do not match.');
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.register({
        name: this.name,
        email: this.email,
        employee_id: this.employeeId,
        password: this.password,
        role: this.role(),
        department_id: this.departmentId,
      });
      await this.feedback.toast('Account created. Welcome!', 'success');
      // '/home' redirects to '', and landingGuard sends each role to its own tab.
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e: any) {
      await this.feedback.toast(e.message ?? 'Registration failed.');
    } finally {
      this.busy.set(false);
    }
  }
}