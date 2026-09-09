import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdateToast.module.css";
import { clearApiCache } from "./clearApiCache";

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
  const updateTimerRef = useRef(null);

  useEffect(() => {
    clearApiCache();
    return () => clearInterval(updateTimerRef.current);
  }, []);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check periodically for a new deployment without changing the
      // currently running application. The user decides when to reload.
      if (!registration) return;
      clearInterval(updateTimerRef.current);
      updateTimerRef.current = setInterval(
        () => {
          registration.update().catch(() => {});
        },
        60 * 60 * 1000,
      );
    },
  });

  const [reloading, setReloading] = useState(false);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      // vite-plugin-pwa's prompt workflow is designed for this exact
      // interaction: activate the waiting worker and reload once the
      // updated worker is ready. Crucially, nothing reloads merely because
      // a service worker takes control during a normal app launch.
      await updateServiceWorker(true);
    } catch {
      // If the worker disappears between detection and the user's click,
      // a normal browser reload is the safest fallback.
      window.location.reload();
    } finally {
      setReloading(false);
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
