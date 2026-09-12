import { useEffect, useState } from "react";

/**
 * Single shared source of truth for "is this browser's network interface
 * up right now" — extracted from OfflineBanner.jsx's own inline version
 * of this exact logic so there's one implementation, not two drifting
 * copies (OfflineBanner for the passive ambient banner, ScanAttendance
 * for the offline-attendance UI branch).
 * <p>
 * Deliberately just navigator.onLine + the browser online/offline
 * events — NOT a live reachability probe of Ehral's API (spec §40's
 * fuller check). See offlineAttendanceService.js#isServerReachable for
 * the one place that does do a real reachability check, used
 * separately where that stronger signal actually matters.
 */
export function useOnlineStatus() {
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

  return online;
}