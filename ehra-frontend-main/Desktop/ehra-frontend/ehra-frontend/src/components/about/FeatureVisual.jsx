import styles from "./FeatureVisual.module.css";

/**
 * Compact feature card: icon, title, one-line description, and an
 * optional status tag. Used throughout the About page's feature grids
 * (workforce, business management, why-Ehral) instead of a screenshot —
 * keeps those sections scannable rather than screenshot-heavy.
 *
 * status: "today" (default, shown as "Available now") | "vision" (shown
 * as "Where we're going") | undefined (no tag at all).
 */
export default function FeatureVisual({
  icon,
  title,
  description,
  status = "today",
}) {
  return (
    <div className={styles.card}>
      <div className={styles.iconWrap}>
        <i className={`ti ${icon}`} aria-hidden="true" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.desc}>{description}</p>
      {status && (
        <span
          className={`${styles.tag} ${status === "vision" ? styles.tagVision : styles.tagToday}`}
        >
          {status === "vision" ? "Where we're going" : "Available now"}
        </span>
      )}
    </div>
  );
}
