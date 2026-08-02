import { useRef, useState } from "react";
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

  const [reloading, setReloading] = useState(false);
  const fallbackTimer = useRef(null);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  // `updateServiceWorker(true)` is *supposed* to post a skip-waiting
  // message to the new worker and reload once it takes over — but that
  // whole handoff depends on `registration.waiting` still pointing at a
  // real worker at the moment of the call. In practice that reference
  // can go stale between the toast appearing and the click (another tab
  // closing, a second update check completing in the background, etc.),
  // in which case the library's internal call quietly does nothing —
  // no error, no reload, just a button that looks broken.
  //
  // Rather than trying to prove that can't happen, we make the button
  // reload unconditionally: try the clean handoff, but also arm a plain
  // `window.location.reload()` as a fallback timer. If the clean path
  // works, the page navigates away and this component (along with the
  // pending timer) is torn down before the fallback ever fires. If the
  // clean path silently no-ops, the fallback fires a moment later and
  // the user still gets a reload — worse case is one slightly-delayed
  // reload instead of a dead button.
  const handleReload = () => {
    if (reloading) return;
    setReloading(true);

    fallbackTimer.current = setTimeout(() => {
      window.location.reload();
    }, 1500);

    Promise.resolve(updateServiceWorker(true)).catch(() => {
      // If the library call itself rejects, don't wait out the full
      // fallback delay — reload right away instead.
      clearTimeout(fallbackTimer.current);
      window.location.reload();
    });
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
