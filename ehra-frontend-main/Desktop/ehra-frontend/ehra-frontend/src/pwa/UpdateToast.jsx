import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdateToast.module.css";

/**
 * Registers the service worker and surfaces two states the rest of the
 * app never has to think about:
 *
 * - `offlineReady`: first install finished precaching — everything works
 *   offline from here on. Shown once, briefly, then dismissed.
 * - `needRefresh`: a NEW service worker has finished installing (i.e. a
 *   new deployment exists) and is waiting to take over. We deliberately
 *   do NOT auto-activate it (registerType: "prompt" in vite.config.js) —
 *   silently swapping the app under someone's fingers mid-form is worse
 *   than asking.
 *
 * IMPORTANT if you're testing this after deploying a fix to THIS file:
 * the tab you're testing in is still running whatever JS was active
 * before the deploy. A new sw.js gets detected and installed in the
 * background regardless, but it sits "waiting" and the OLD code (with
 * whatever bug it had) is what actually runs when you click the button
 * in that already-open tab — the fix can't apply to itself. Hard-refresh
 * (Ctrl/Cmd+Shift+R) or close and reopen the tab once after deploying a
 * change here, THEN test the button, so you're actually exercising the
 * new code and not the code this deploy was meant to replace.
 */
export default function UpdateToast() {
  const registrationRef = useRef(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration || null;
      // Poll for a new deployment periodically — service workers only
      // check for updates on navigation by default, which is too rare
      // for a long-lived, rarely-refreshed dashboard tab.
      if (!registration) return;
      setInterval(
        () => {
          registration.update().catch(() => {});
        },
        60 * 60 * 1000,
      ); // hourly is plenty; avoids hammering the CDN
    },
  });

  const [reloading, setReloading] = useState(false);
  const fallbackTimer = useRef(null);
  const reloadedRef = useRef(false);

  const doReload = () => {
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    clearTimeout(fallbackTimer.current);
    window.location.reload();
  };

  // Listen for the browser's own signal that a new worker has taken
  // control, rather than trusting a third-party helper's internal
  // bookkeeping to still be valid by the time it fires. This is the
  // same event the spec defines for exactly this purpose.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("controllerchange", doReload);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", doReload);
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  // Drives the handoff directly against the raw Service Worker API
  // instead of going through vite-plugin-pwa's updateServiceWorker()
  // helper — that helper's reload path depends on `registration.waiting`
  // still pointing at a real worker AND on its own controllerchange
  // listener still being attached by the time this fires; either one
  // going stale between the toast appearing and the click makes it a
  // silent no-op with no error. Doing it ourselves means there's no
  // hidden step we can't see or account for:
  //
  //   1. If a waiting worker exists, tell it to activate.
  //   2. The controllerchange listener above reloads once that
  //      activation actually happens.
  //   3. Regardless of either of those, force a reload after 1.5s no
  //      matter what — the worst case is one slightly-delayed reload
  //      instead of a button that does nothing.
  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    fallbackTimer.current = setTimeout(doReload, 1500);

    try {
      let registration = registrationRef.current;
      if (!registration && "serviceWorker" in navigator) {
        registration = await navigator.serviceWorker.getRegistration();
      }
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // Fall through to the timer below regardless.
    }
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <div className={styles.body}>
        <p className={styles.title}>
          {needRefresh
            ? "A new version of Ehral is available."
            : "Ehral is ready to work offline."}
        </p>
        {needRefresh && (
          <p className={styles.subtitle}>
            Reload to get the latest features and fixes.
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
