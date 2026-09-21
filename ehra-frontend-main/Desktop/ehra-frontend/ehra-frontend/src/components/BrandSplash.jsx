import Logo from "./Logo";
import styles from "./BrandSplash.module.css";

// The one full-screen "Ehral is loading" screen for the customer experience.
// The same component is shown when signing in, when opening a business or its
// store, and when returning to the dashboard, so the logo, size, animation and
// spacing never change from one step to the next.
//
//   message   line under the progress bar, e.g. "Opening business…"
//   busy      false for a resting state (an error or "not available" page):
//             the progress bar and live-region announcement are dropped
//   children  extra content under the logo (title, text, a button)
export default function BrandSplash({ message, busy = true, children }) {
  return (
    <div
      className={styles.splash}
      role={busy ? "status" : undefined}
      aria-live={busy ? "polite" : undefined}
    >
      <span className={styles.logo}>
        <Logo size={112} variant="horizontal" tone="brand" title="Ehral" />
      </span>
      {busy && <span className={styles.bar} aria-hidden="true" />}
      {message && <p className={styles.message}>{message}</p>}
      {children}
    </div>
  );
}
