import { getRoleColor, getRoleShortLabel } from "../../utils/roleBadge";
import styles from "./RoleBadge.module.css";

// A compact, color-coded, gently pulsing indicator of WHO you're talking
// to — Employer, HOD, Employee, Customer, or any role introduced later
// (see utils/roleBadge.js — a brand-new role automatically gets its own
// consistent color with zero changes needed here). Only meaningful for
// one specific person, so callers only render this for DIRECT
// conversations; a group or the Announcements channel has many people
// with different roles, not a single one to badge.
export default function RoleBadge({ roleLabel, size = "md" }) {
  if (!roleLabel) return null;
  const color = getRoleColor(roleLabel);
  const shortLabel = getRoleShortLabel(roleLabel);

  return (
    <span
      className={`${styles.badge} ${size === "sm" ? styles.sm : ""}`}
      style={{ "--role-color": color }}
      title={roleLabel}
    >
      <span className={styles.pulseDot}>
        <span className={styles.pulseRing} />
      </span>
      {shortLabel}
    </span>
  );
}
