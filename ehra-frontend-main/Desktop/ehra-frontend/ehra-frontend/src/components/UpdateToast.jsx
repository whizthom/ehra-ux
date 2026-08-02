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
 *   than asking. `updateServiceWorker(true)` both activates the new
 *   worker and reloads the page in one call.
 */
export default function UpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
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

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
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
            <button type="button" className={styles.later} onClick={close}>
              Later
            </button>
            <button
              type="button"
              className={styles.reload}
              onClick={() => updateServiceWorker(true)}
            >
              Reload now
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
