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
 * Detection: `onRegisteredSW` starts a ~2s interval (production only -
 * see the `import.meta.env.PROD` guard) that does a plain, cache-busted
 * `fetch(swUrl)` and only calls the real `registration.update()` when
 * that fetch actually succeeds. This mirrors vite-plugin-pwa's own
 * documented pattern for periodic checks: `registration.update()` alone
 * re-downloads and diffs the whole sw.js against the installed copy on
 * every tick regardless of network state, so gating it behind a cheap
 * fetch first means a flaky/offline connection costs one small failed
 * request every 2s instead of a full service-worker update attempt. The
 * interval is a single ref-guarded instance, stops on unmount, pauses
 * while the tab is hidden (`visibilitychange`) or the browser reports
 * offline, and resumes on `online`/visible again - so a tab left open
 * for hours doesn't burn battery/network chattering in the background,
 * but a tab you're actually looking at picks up a new deployment fast.
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

const CHECK_INTERVAL_MS = 2000;
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

      const runCheck = async () => {
        try {
          if (document.hidden) return;
          if ("onLine" in navigator && !navigator.onLine) return;
          const resp = await fetch(swUrl, {
            cache: "no-store",
            headers: { "cache-control": "no-cache" },
          });
          if (resp && resp.status === 200) {
            await registration.update();
          }
        } catch {
          // Network hiccup / offline / server briefly unavailable - never
          // fatal, just try again on the next tick.
        }
      };

      const startInterval = () => {
        if (timerId) return;
        timerId = setInterval(runCheck, CHECK_INTERVAL_MS);
      };
      const stopInterval = () => {
        clearInterval(timerId);
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
