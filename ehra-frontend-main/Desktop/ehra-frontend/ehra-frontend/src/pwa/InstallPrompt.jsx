import { useEffect, useState } from "react";
import styles from "./InstallPrompt.module.css";

const DISMISSED_KEY = "ehral:installPromptDismissed";

function isRunningStandalone() {
  const mql = window.matchMedia?.("(display-mode: standalone)");
  return Boolean(mql?.matches) || Boolean(window.navigator.standalone);
}

function isIOSDevice() {
  const platform = navigator.platform || "";
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Shows the native install prompt where Chromium exposes it and a small
 * manual-install guide on iPhone/iPad, where beforeinstallprompt is not
 * exposed. The prompt is always dismissible and never blocks the app.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isRunningStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;

    const iosDevice = isIOSDevice();
    setIos(iosDevice);

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

    // iOS has no beforeinstallprompt event. Show the same dismissible card
    // with the platform's manual Add to Home Screen instructions instead.
    if (iosDevice) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
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
          {ios
            ? "On iPhone or iPad, tap Share, then Add to Home Screen."
            : "Add it to your home screen for a faster, full-screen experience."}
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
        {!ios && (
          <button
            type="button"
            className={styles.install}
            onClick={handleInstall}
            disabled={installing || !deferredPrompt}
          >
            {installing ? "Installing…" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}
