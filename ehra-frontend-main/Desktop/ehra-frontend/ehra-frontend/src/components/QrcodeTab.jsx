import { Suspense, lazy, useState } from "react";
import QrAttendancePanel from "./QrAttendancePanel";
import styles from "./QrcodeTab.module.css";

// Lazy-loaded so that if anything in the Settings panel's dependency tree
// fails to resolve (e.g. a fresh dependency that hasn't been npm-installed
// yet), it can't break the Live QR tab too — Live QR keeps working
// regardless, and only the Settings tab shows an error.
const AttendanceSettingsPanel = lazy(() => import("./AttendanceSettingsPanel"));

const TABS = [
  { key: "live", label: "Live QR" },
  { key: "settings", label: "Settings" },
];

/**
 * "QR Code" nav destination. Two views:
 *  - Live QR: the rotating attendance code (unchanged from before).
 *  - Settings: attendance method (Dynamic/Static QR) + Attendance Zone
 *    (GPS) configuration — everything from the attendance module spec
 *    lives here so it's all in one place for the employer.
 */
export default function QrCodeTab() {
  const [tab, setTab] = useState("live");

  return (
    <div className={styles.layout}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={`${styles.tabBody} ${tab === "live" ? styles.tabBodyCentered : ""}`}
      >
        {tab === "live" ? (
          <div className={styles.wrap}>
            <div className={styles.intro}>
              <h2 className={styles.title}>Attendance QR code</h2>
              <p className={styles.desc}>
                Employees scan this with their phone camera to clock in or out.
                It rotates automatically every 5 seconds, so a screenshot or
                photo of it stops working almost immediately — display it
                somewhere visible at your entrance or front desk.
              </p>
            </div>

            <div className={styles.panelWrap}>
              <QrAttendancePanel />
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className={styles.settingsLoading}>Loading settings…</div>
            }
          >
            <AttendanceSettingsPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}
