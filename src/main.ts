import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Register the <jeep-sqlite> web component (only used when running in a browser)
jeepSqlite(window);

async function start() {
  // On the web, SQLite runs through jeep-sqlite, which must exist in the DOM
  // BEFORE the database is opened. On Android/iOS this block is skipped.
  if (Capacitor.getPlatform() === 'web') {
    document.body.appendChild(document.createElement('jeep-sqlite'));
    await customElements.whenDefined('jeep-sqlite');
  }

  await bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(PreloadAllModules)),
    ],
  });
}

start();