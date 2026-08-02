import { useEffect, useState } from "react";
import styles from "./OfflineBanner.module.css";

/**
 * A thin "you're offline" banner rather than a full interstitial page —
 * the whole point of precaching (see workbox config in vite.config.js)
 * is that most recently visited pages keep working offline, so hijacking
 * the entire screen every time connectivity blips would undersell that.
 * Anything that genuinely needs the network (submitting a form, an
 * uncached page) still fails on its own with its existing error
 * handling; this is purely an ambient "heads up" signal.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      <i className="ti ti-wifi-off" />
      <span>You're offline — showing previously loaded content.</span>
    </div>
  );
}
