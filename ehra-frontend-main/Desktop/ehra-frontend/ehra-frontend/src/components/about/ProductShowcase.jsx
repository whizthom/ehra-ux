import DeviceFrame from "./DeviceFrame";
import DashboardPreview from "./DashboardPreview";
import MobileProductPreview from "./MobileProductPreview";
import styles from "./ProductShowcase.module.css";

/**
 * The hero's signature visual: the real Ehral desktop dashboard and the
 * real Ehral mobile attendance screen, composed together with depth —
 * so the very first thing a visitor sees is the actual product, not an
 * illustration of "a product like this".
 */
export default function ProductShowcase() {
  return (
    <div className={styles.stage}>
      <div className={styles.desktopLayer}>
        <DeviceFrame variant="browser" label="app.ehral.com/dashboard">
          <DashboardPreview screen="overview" />
        </DeviceFrame>
      </div>

      <div className={styles.phoneLayer}>
        <MobileProductPreview screen="attendance" />
      </div>

      <div className={styles.floatCard} aria-hidden="true">
        <i className="ti ti-fingerprint" />
        <div>
          <strong>Amaka O. checked in</strong>
          <span>Engineering · 8:52 AM</span>
        </div>
      </div>
    </div>
  );
}
