import { Component, inject } from '@angular/core';
import { IonLabel, IonTabBar, IonTabButton, IonTabs, IonIcon } from '@ionic/angular';
// Icons ship with Ionic, so no install is needed. Each name here must also appear in addIcons() below.
import {
  homeOutline,
  addCircleOutline,
  documentsOutline,
  personCircleOutline,
  speedometerOutline,
  settingsOutline,
  clipboardOutline,
  peopleOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AuthService } from '../services/auth.service';

// The shell around every tab page. The tab bar reads the user's role from the
// auth signal, so it also updates correctly if you log out and in as another role.
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="custom-tab-bar">

        @switch (auth.user()?.role) {

          @case ('faculty') {
            <ion-tab-button tab="faculty-home">
              <ion-icon name="home-outline"></ion-icon>
              <ion-label>Home</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="new-report">
              <ion-icon name="add-circle-outline"></ion-icon>
              <ion-label>New Report</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="my-reports">
              <ion-icon name="documents-outline"></ion-icon>
              <ion-label>My Reports</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="account">
              <ion-icon name="person-circle-outline"></ion-icon>
              <ion-label>Account</ion-label>
            </ion-tab-button>
          }

          @case ('admin') {
            <ion-tab-button tab="dashboard">
              <ion-icon name="speedometer-outline"></ion-icon>
              <ion-label>Dashboard</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="manage-reports">
              <ion-icon name="clipboard-outline"></ion-icon>
              <ion-label>Manage</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="control-center">
              <ion-icon name="settings-outline"></ion-icon>
              <ion-label>Control</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="account">
              <ion-icon name="person-circle-outline"></ion-icon>
              <ion-label>Account</ion-label>
            </ion-tab-button>
          }

          @case ('personnel') {
            <ion-tab-button tab="assigned">
              <ion-icon name="people-outline"></ion-icon>
              <ion-label>Assigned</ion-label>
            </ion-tab-button>

            <ion-tab-button tab="account">
              <ion-icon name="person-circle-outline"></ion-icon>
              <ion-label>Account</ion-label>
            </ion-tab-button>
          }
        }

      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tabs {
      --background: #f6f5ee;
    }

    .custom-tab-bar {
      --background: #fbfaf5;
      --border: 1px solid #e2e8dc;
      --color: #87958a;
      --color-selected: #29483d;

      position: relative;
      min-height: 70px;
      padding: 7px 8px max(7px, env(safe-area-inset-bottom));
      border-top: 1px solid #e2e8dc;
      box-shadow: 0 -5px 20px rgba(32, 59, 53, 0.06);
    }

    ion-tab-button {
      --color: #87958a;
      --color-selected: #29483d;
      --ripple-color: #a8c5a0;

      max-width: 180px;
      min-height: 54px;
      margin: 0 3px;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2px;
      transition: background-color 0.2s ease;
    }

    ion-tab-button ion-icon {
      font-size: 22px;
      margin-bottom: 4px;
    }

    ion-tab-button ion-label {
      font-size: 11px;
      margin-top: 1px;
    }

    /* Ionic adds tab-selected to the active tab automatically */
    ion-tab-button.tab-selected {
      --color: #29483d;
      background: #e8efe3;
      font-weight: 700;
    }

    ion-tab-button.tab-selected ion-icon {
      color: #29483d;
    }

    /* Narrow phones: shrink the labels and icons so five tabs still fit */
    @media (max-width: 360px) {
      .custom-tab-bar {
        padding-left: 2px;
        padding-right: 2px;
      }

      ion-tab-button {
        margin: 0 1px;
        font-size: 10px;
      }

      ion-tab-button ion-icon {
        font-size: 20px;
      }

      ion-tab-button ion-label {
        font-size: 10px;
      }
    }
  `],
})
export class TabsPage {
  auth = inject(AuthService);

  constructor() {
    // Register every icon used in the template. An unregistered name shows as a blank space.
    addIcons({
      homeOutline,
      addCircleOutline,
      documentsOutline,
      personCircleOutline,
      speedometerOutline,
      settingsOutline,
      clipboardOutline,
      peopleOutline,
    });
  }
}