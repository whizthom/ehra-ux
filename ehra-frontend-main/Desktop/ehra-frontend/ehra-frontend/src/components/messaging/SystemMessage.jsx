import styles from "./MessageBubble.module.css";

// Renders a business-generated SYSTEM message (section 6/31). The
// systemType in metadata is what a future feature (leave decisions,
// payroll, attendance, announcements...) would branch on for a richer
// layout/icon; V1 just needs the mechanism to not look out of place, so
// every systemType falls back to a plain centered pill showing the
// human-readable body Ehral generated for it.
export default function SystemMessage({ message }) {
  return (
    <div className={styles.systemRow}>
      <span className={styles.systemPill}>{message.body}</span>
    </div>
  );
}
