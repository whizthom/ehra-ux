import { useRef } from "react";
import MyProfileSettings from "./MyProfileSettings";
import EmployeeProfileEditsTab from "./EmployeeProfileEditsTab";
import styles from "./MyProfileTab.module.css";

// Merges the previously separate "Settings" (read-only profile view) and
// "Profile Edits" (request-a-change form + request history + HOD approval
// queue) navs into a single "My Profile" destination. Both original
// components are reused as-is and simply stacked, so behavior is unchanged
// — the employee still sees their profile and still gets the exact same
// edit/request flow (name, position, ID document, profile picture, phone,
// date of birth, gender, address, emergency contact — all approval-gated),
// just on one page instead of two tabs. The "Request a change" button on
// the profile card scrolls down to the edit section instead of switching
// tabs, since there's no longer a separate tab to switch to.
export default function MyProfileTab({ profile, isHod }) {
  const editSectionRef = useRef(null);

  const scrollToEditSection = () => {
    editSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className={styles.wrap}>
      <MyProfileSettings
        profile={profile}
        onGoToProfileEdits={scrollToEditSection}
      />
      <div ref={editSectionRef}>
        <EmployeeProfileEditsTab isHod={isHod} profile={profile} />
      </div>
    </div>
  );
}
