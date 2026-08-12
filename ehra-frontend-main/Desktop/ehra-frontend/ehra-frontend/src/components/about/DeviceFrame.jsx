import styles from "./DeviceFrame.module.css";

/**
 * Generic device chrome. Wraps arbitrary content (usually a
 * <DashboardPreview /> or <MobileProductPreview /> screen) in a frame that
 * reads instantly as "this is the real app", without pulling in a design
 * system of its own — colors are drawn from theme.css so it repaints with
 * light/dark mode automatically.
 *
 * variant:
 *  - "browser"  desktop/tablet browser chrome (traffic lights + url pill)
 *  - "phone"    iOS-style phone frame (notch + side buttons)
 *  - "bare"     just a soft-shadowed rounded panel, no chrome — for
 *               tightly-cropped feature callouts where a full frame would
 *               fight the content
 */
export default function DeviceFrame({
  variant = "browser",
  label,
  children,
  className = "",
}) {
  if (variant === "phone") {
    return (
      <div className={`${styles.phone} ${className}`}>
        <div className={styles.phoneNotch} aria-hidden="true" />
        <div className={styles.phoneScreen}>{children}</div>
        <div className={styles.phoneHomeBar} aria-hidden="true" />
      </div>
    );
  }

  if (variant === "bare") {
    return <div className={`${styles.bare} ${className}`}>{children}</div>;
  }

  return (
    <div className={`${styles.browser} ${className}`}>
      <div className={styles.browserBar}>
        <span className={styles.dot} style={{ background: "#f15c6d" }} />
        <span className={styles.dot} style={{ background: "#ffc24b" }} />
        <span className={styles.dot} style={{ background: "#55e0ae" }} />
        {label && (
          <span className={styles.urlPill}>
            <i className="ti ti-lock" aria-hidden="true" />
            {label}
          </span>
        )}
      </div>
      <div className={styles.browserScreen}>{children}</div>
    </div>
  );
}
