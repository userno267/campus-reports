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
    <ion-header>
      <ion-toolbar><ion-title>{{ title }}</ion-title></ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p>{{ title }}: coming in a later feature.</p>
      <p>Logged in as {{ auth.user()?.name }} ({{ auth.user()?.role }})</p>
    </ion-content>
  `,
})
export class PlaceholderPage {
  auth = inject(AuthService);
  title: string = inject(ActivatedRoute).snapshot.data['title'] ?? 'Coming soon';
}