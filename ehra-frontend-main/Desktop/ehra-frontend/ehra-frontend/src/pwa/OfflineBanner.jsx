import styles from "./OfflineBanner.module.css";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * A thin "you're offline" banner rather than a full interstitial page -
 * the whole point of precaching (see workbox config in vite.config.js)
 * is that most recently visited pages keep working offline, so hijacking
 * the entire screen every time connectivity blips would undersell that.
 * Anything that genuinely needs the network (submitting a form, an
 * uncached page) still fails on its own with its existing error
 * handling; this is purely an ambient "heads up" signal.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      <i className="ti ti-wifi-off" />
      <span>You're offline - showing previously loaded content.</span>
    </div>
  );
}
