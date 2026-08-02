import { useEffect, useState } from "react";
import styles from "./InstallPrompt.module.css";

const DISMISSED_KEY = "ehral:installPromptDismissed";

/**
 * Detects whether the app is already running as an installed PWA.
 *
 * - `display-mode: standalone` covers Android/desktop Chrome, Edge, etc.
 * - `navigator.standalone` is Safari/iOS's own (non-standards) flag —
 *   iOS never fires `beforeinstallprompt` at all, so this is the only
 *   signal we get there.
 */
function isRunningStandalone() {
  const mql = window.matchMedia?.("(display-mode: standalone)");
  return Boolean(mql?.matches) || Boolean(window.navigator.standalone);
}

/**
 * Beautiful, dismissible "Install Ehral" card. Renders nothing until the
 * browser tells us installation is actually possible (`beforeinstallprompt`),
 * and never renders again once the app is installed — checked both at
 * mount (already installed) and on `appinstalled` (installed just now).
 *
 * Dismissing the card ("Not now") remembers that choice in localStorage
 * so it doesn't nag on every visit; it resets automatically once actually
 * installed, since at that point the app removes itself from the DOM
 * anyway and won't come back on `beforeinstallprompt` again.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isRunningStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        // They saw the native prompt and said no — respect that like a
        // dismissal so we don't immediately show our card again.
        localStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  return (
    <div className={styles.card} role="dialog" aria-label="Install Ehral">
      <div className={styles.iconWrap}>
        <img src="/icons/icon-96x96.png" alt="" width={40} height={40} />
      </div>
      <div className={styles.body}>
        <p className={styles.title}>Install Ehral</p>
        <p className={styles.subtitle}>
          Add it to your home screen for a faster, full-screen experience.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.dismiss}
          onClick={handleDismiss}
          disabled={installing}
        >
          Not now
        </button>
        <button
          type="button"
          className={styles.install}
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? "Installing…" : "Install"}
        </button>
      </div>
    </div>
  );
}
