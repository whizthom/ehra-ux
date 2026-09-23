import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdateToast.module.css";

/**
 * Registers the service worker and surfaces two states the rest of the
 * app never has to think about:
 *
 * - `offlineReady`: first install finished precaching - everything works
 *   offline from here on. Shown once, briefly, then dismissed.
 * - `needRefresh`: a NEW service worker (i.e. a new Railway deployment)
 *   has finished installing and is sitting "waiting" - it does NOT take
 *   over the page on its own (registerType: "prompt" + skipWaiting left
 *   at its workbox default of false, both in vite.config.js). Only
 *   `updateServiceWorker(true)` below tells it to skip waiting, claim the
 *   page, and reload.
 *
 * Detection: `onRegisteredSW` schedules a background check every
 * ~45-60s (BASE_CHECK_INTERVAL_MS + random jitter - see the constants
 * below) that does a *conditional* `fetch(swUrl, { cache: "no-cache" })`
 * and only calls the real `registration.update()` when that comes back
 * 200 (a genuine change), not 304 (unchanged). This is deliberately
 * tuned for an app with a large concurrent user base: a flat,
 * unconditional, synchronized-interval poll from every open tab scales
 * badly - at a few thousand users it's noise, at millions of open tabs
 * it's a self-inflicted traffic spike on your own origin every single
 * tick. Jitter spreads that load out instead of bursting it, and
 * `cache: "no-cache"` (as opposed to `"no-store"`) lets the request go
 * out as a conditional GET against the ETag Caddy already sets on sw.js,
 * so an unchanged file costs a ~0-byte 304 instead of a full response -
 * cheap for the origin (or a CDN in front of it) even at very high
 * concurrency. Responsiveness for the tab someone's actually watching
 * isn't given up, though: `onVisibility`/`onOnline` below trigger an
 * immediate out-of-band check the moment a tab regains focus or comes
 * back online, rather than waiting out the rest of the interval. The
 * interval is a single ref-guarded instance, single-flight (won't stack
 * overlapping requests if one is slow), stops on unmount, and pauses
 * entirely while the tab is hidden or the browser reports offline.
 *
 * Reload safety: EHRAL is full of forms (leave requests, employee edits,
 * payroll, messaging composers). Reloading the instant a new version is
 * detected could wipe out something someone is mid-typing, so when
 * `needRefresh` flips true we only auto-reload if nothing that looks
 * like an active form field is focused; otherwise the toast stays up
 * (non-blocking) and re-checks on every `focusout` until the coast is
 * clear, or until the user just clicks "Reload now" themselves. Either
 * way this is the only path that ever calls `updateServiceWorker`;
 * nothing here silently reloads a tab that has a field in progress.
 *
 * IMPORTANT if you're testing this after deploying a fix to THIS file:
 * the tab you're testing in is still running whatever JS was active
 * before the deploy. A new sw.js gets detected and installed in the
 * background regardless, but it sits "waiting" and the OLD code (with
 * whatever bug it had) is what actually runs in that already-open tab
 * until something calls updateServiceWorker - the fix can't apply to
 * itself. Hard-refresh (Ctrl/Cmd+Shift+R) or close and reopen the tab
 * once after deploying a change here, THEN test, so you're actually
 * exercising the new code.
 */

// At small/medium scale a flat 2s poll from every open tab is fine. At
// "millions of users" scale it isn't: millions of tabs on a synchronized
// 2s tick is a self-inflicted DDoS on your own origin. Two changes fix
// that without giving up fast detection for the tab someone's actually
// looking at:
//
// 1. The *base* interval is wider (45s) but every tab adds up to 15s of
//    random jitter on top, so instead of one huge synchronized spike
//    every 2s, load smears out continuously across a 45-60s window.
// 2. `runCheck` regains near-2s responsiveness the moment it matters -
//    on tab focus/visibility-regain and on reconnect - since that's when
//    someone's actually watching for the update, not on an idle
//    background tab nobody's looking at.
const BASE_CHECK_INTERVAL_MS = 45_000;
const CHECK_JITTER_MS = 15_000;
const AUTO_RELOAD_GRACE_MS = 2500;

function isFormFieldActive() {
  const el = typeof document !== "undefined" ? document.activeElement : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function UpdateToast() {
  const stopPollingRef = useRef(null);
  const autoReloadTimerRef = useRef(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // Production only: local `npm run dev` should never poll for a
      // deployment that doesn't exist, and vite-plugin-pwa's dev SW
      // support is opt-in (devOptions.enabled) anyway - this guard just
      // makes the intent explicit rather than relying on that default.
      if (!import.meta.env.PROD) return;

      let timerId = null;
      let checking = false;

      const runCheck = async () => {
        // Single-flight: if a check is still in the air (slow network,
        // etc.) when the next tick or a visibility/online event fires,
        // skip rather than piling up overlapping requests.
        if (checking) return;
        checking = true;
        try {
          if (document.hidden) return;
          if ("onLine" in navigator && !navigator.onLine) return;
          // `cache: "no-cache"` (not "no-store") means the browser is
          // allowed to send the request conditionally - with
          // If-None-Match / If-Modified-Since, using the ETag/
          // Last-Modified Caddy's file_server already sets on sw.js. If
          // sw.js hasn't changed, the origin (or an edge/CDN cache in
          // front of it) answers with a ~0-byte 304 instead of resending
          // the whole file. That's what keeps this cheap at scale - every
          // open tab still "checks" on every tick, but almost all of
          // those checks are 304s, not full downloads.
          const resp = await fetch(swUrl, { cache: "no-cache" });
          if (resp && resp.status === 200) {
            await registration.update();
          }
        } catch {
          // Network hiccup / offline / server briefly unavailable - never
          // fatal, just try again on the next tick.
        } finally {
          checking = false;
        }
      };

      const scheduleNext = () => {
        clearTimeout(timerId);
        const delay = BASE_CHECK_INTERVAL_MS + Math.random() * CHECK_JITTER_MS;
        timerId = setTimeout(async () => {
          await runCheck();
          scheduleNext();
        }, delay);
      };
      const startInterval = () => {
        if (timerId) return;
        scheduleNext();
      };
      const stopInterval = () => {
        clearTimeout(timerId);
        timerId = null;
      };

      startInterval();

      // Also check right away on regaining visibility/connectivity,
      // rather than waiting up to one more full tick.
      const onVisibility = () => {
        if (document.hidden) {
          stopInterval();
        } else {
          startInterval();
          runCheck();
        }
      };
      const onOnline = () => {
        startInterval();
        runCheck();
      };
      const onOffline = () => stopInterval();

      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);

      stopPollingRef.current = () => {
        stopInterval();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    },
  });

  useEffect(() => {
    return () => {
      stopPollingRef.current?.();
      clearTimeout(autoReloadTimerRef.current);
    };
  }, []);

  const [reloading, setReloading] = useState(false);

  const applyUpdate = useCallback(async () => {
    setReloading(true);
    try {
      await updateServiceWorker(true);
    } catch {
      // If the worker disappears between detection and activation, a
      // normal browser reload is the safest fallback - it will simply
      // pick up whatever is currently live.
      window.location.reload();
    }
  }, [updateServiceWorker]);

  // Auto-reload path: only when it's safe. Runs whenever `needRefresh`
  // turns on, and re-arms on every focusout so a form the user just
  // finished with doesn't keep blocking the update indefinitely.
  useEffect(() => {
    if (!needRefresh || reloading) return undefined;

    const tryAutoReload = () => {
      clearTimeout(autoReloadTimerRef.current);
      if (isFormFieldActive()) return;
      autoReloadTimerRef.current = setTimeout(() => {
        if (!isFormFieldActive()) applyUpdate();
      }, AUTO_RELOAD_GRACE_MS);
    };

    tryAutoReload();
    document.addEventListener("focusout", tryAutoReload);
    return () => {
      clearTimeout(autoReloadTimerRef.current);
      document.removeEventListener("focusout", tryAutoReload);
    };
  }, [needRefresh, reloading, applyUpdate]);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    clearTimeout(autoReloadTimerRef.current);
  };

  const handleReload = () => {
    if (reloading) return;
    applyUpdate();
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <div className={styles.body}>
        <p className={styles.title}>
          {needRefresh
            ? reloading
              ? "Updating Ehral…"
              : "A new version of Ehral is available."
            : "Ehral is ready to work offline."}
        </p>
        {needRefresh && !reloading && (
          <p className={styles.subtitle}>
            Applying automatically in a moment. Reload now, or keep working and
            it'll update as soon as you're done with this field.
          </p>
        )}
      </div>
      <div className={styles.actions}>
        {needRefresh ? (
          <>
            <button
              type="button"
              className={styles.later}
              onClick={close}
              disabled={reloading}
            >
              Later
            </button>
            <button
              type="button"
              className={styles.reload}
              onClick={handleReload}
              disabled={reloading}
            >
              {reloading ? "Reloading…" : "Reload now"}
            </button>
          </>
        ) : (
          <button type="button" className={styles.later} onClick={close}>
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
