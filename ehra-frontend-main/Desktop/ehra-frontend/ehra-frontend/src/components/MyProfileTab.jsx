import { useRef, useState } from "react";
import MyProfileSettings from "./MyProfileSettings";
import EmployeeProfileEditsTab from "./EmployeeProfileEditsTab";
import SecuritySettingsSection from "./SecuritySettingsSection";
import styles from "./MyProfileTab.module.css";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
];

// Merges the previously separate "Settings" (read-only profile view) and
// "Profile Edits" (request-a-change form + request history + HOD approval
// queue) into the "Profile" sub-tab here — unchanged from before, just
// under a tab now. "Security" is new: the same SecuritySettingsSection
// component the employer uses for their own account (2FA / password),
// reused as-is so employees get the exact same self-service 2FA setup.
export default function MyProfileTab({ profile, isHod }) {
  const [tab, setTab] = useState("profile");
  const editSectionRef = useRef(null);

  const scrollToEditSection = () => {
    setTab("profile");
    // Wait a tick for the Profile tab to be back in the DOM before
    // scrolling to a section inside it.
    requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div className={styles.layout}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.key === "security" && <i className="ti ti-shield-lock" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* This is the scroll owner — the employee dashboard's shared
          .contentFull wrapper deliberately doesn't scroll itself (the
          outer .main handles the app chrome), so each full-page nav
          destination scrolls its own body rather than relying on an
          ancestor that won't provide one. */}
      <div className={styles.tabBody}>
        {tab === "profile" ? (
          <div className={styles.wrap}>
            <MyProfileSettings
              profile={profile}
              onGoToProfileEdits={scrollToEditSection}
            />
            <div ref={editSectionRef}>
              <EmployeeProfileEditsTab isHod={isHod} profile={profile} />
            </div>
          </div>
        ) : (
          <div className={styles.securityPad}>
            <SecuritySettingsSection />
          </div>
        )}
      </div>
    </div>
  );
}
