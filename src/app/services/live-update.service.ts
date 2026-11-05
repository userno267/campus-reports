import { Injectable, inject } from '@angular/core';
import { ApiService, ChangeTarget } from './api.service';

// Smart polling: keeps a screen up to date without a manual refresh and without reloading the page.
//
// How it works:
//  1. The screen asks the server for a tiny "change token" (changes.php), not for the data.
//  2. When the token is different from the last one, the screen reloads its data, silently.
//  3. When nothing changes, the app checks less and less often (5 s, then 10 s, 20 s, 30 s).
//     Any change, or coming back to the app, brings it back to 5 s.
//  4. Nothing is sent while the browser tab is hidden (or the phone screen is off).
//
// The app runs without zone.js, so a timer does not redraw anything by itself.
// A screen only redraws when its refresh callback runs and calls markForCheck.

// Seconds between checks while nothing changes. Each step lasts QUIET_CHECKS_PER_STEP checks.
const DELAYS_MS = [5000, 10000, 20000, 30000];
const QUIET_CHECKS_PER_STEP = 6;

export interface LiveWatcher {
  // Stops the checks. Call it when the screen is left or destroyed.
  stop(): void;
}

@Injectable({ providedIn: 'root' })
export class LiveUpdateService {
  private api = inject(ApiService);

  // Starts watching one target and returns a handle to stop it.
  //  - target:   what to watch (see changes.php)
  //  - refresh:  loads the screen's data. It is called once now with silent = false (the normal first
  //              load, with spinner and error message) and again with silent = true whenever the data changed.
  //              A silent refresh must not show a spinner or a toast.
  //  - requestId: only for target 'request'
  watch(
    target: ChangeTarget,
    refresh: (silent: boolean) => Promise<void>,
    requestId: number | null = null
  ): LiveWatcher {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let token: string | null = null;
    let quietChecks = 0;     // checks in a row where nothing changed
    let checking = false;    // true while a check is on its way, so two never overlap

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const nextDelay = () => DELAYS_MS[Math.min(Math.floor(quietChecks / QUIET_CHECKS_PER_STEP), DELAYS_MS.length - 1)];

    const schedule = () => {
      clearTimer();
      if (stopped) return;
      timer = setTimeout(runCheck, nextDelay());
    };

    // One check. Errors (server offline, logged out) are ignored: the next check tries again.
    const check = async () => {
      if (checking || stopped) return;
      checking = true;
      try {
        const next = await this.api.checkChanges(target, requestId);
        if (stopped) return;
        const changed = token !== null && next !== token;
        // The token is saved BEFORE the reload. If something changes during the reload,
        // the next check sees a different token and reloads again, so nothing is missed.
        token = next;
        if (changed) {
          quietChecks = 0;
          await refresh(true);
        } else {
          quietChecks++;
        }
      } catch {
        quietChecks++;
      } finally {
        checking = false;
      }
    };

    const runCheck = async () => {
      timer = null;
      if (stopped) return;
      if (document.hidden) return;   // paused. The visibilitychange handler below starts it again.
      await check();
      schedule();
    };

    // Back in the app or tab: check at once and return to the fast rhythm.
    const onVisibilityChange = () => {
      if (stopped || document.hidden) return;
      quietChecks = 0;
      clearTimer();
      void runCheck();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Start: read the token FIRST, then load the data. A change that happens in between
    // is caught by the next check, because the token is older than the data.
    const start = async () => {
      try {
        token = await this.api.checkChanges(target, requestId);
      } catch {
        token = null;
      }
      if (stopped) return;
      try {
        await refresh(false);
      } catch {
        /* the screen shows its own error */
      }
      schedule();
    };
    void start();

    return {
      stop: () => {
        stopped = true;
        clearTimer();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      },
    };
  }
}