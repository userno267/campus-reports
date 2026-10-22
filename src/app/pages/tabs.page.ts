import { Component, inject } from '@angular/core';
import { IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

// The shell around every tab page. The tab bar reads the user's role from the
// auth signal, so it also updates correctly if you log out and in as another role.
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @switch (auth.user()?.role) {
          @case ('faculty') {
            <ion-tab-button tab="faculty-home"><ion-label>Home</ion-label></ion-tab-button>
            <ion-tab-button tab="new-report"><ion-label>New Report</ion-label></ion-tab-button>
            <ion-tab-button tab="my-reports"><ion-label>My Reports</ion-label></ion-tab-button>
            <ion-tab-button tab="account"><ion-label>Account</ion-label></ion-tab-button>
          }
          @case ('admin') {
            <ion-tab-button tab="dashboard"><ion-label>Dashboard</ion-label></ion-tab-button>
            <ion-tab-button tab="manage-reports"><ion-label>Manage</ion-label></ion-tab-button>
            <ion-tab-button tab="control-center"><ion-label>Control</ion-label></ion-tab-button>
            <ion-tab-button tab="account"><ion-label>Account</ion-label></ion-tab-button>
          }
          @case ('personnel') {
            <ion-tab-button tab="assigned"><ion-label>Assigned</ion-label></ion-tab-button>
            <ion-tab-button tab="account"><ion-label>Account</ion-label></ion-tab-button>
          }
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  auth = inject(AuthService);
}