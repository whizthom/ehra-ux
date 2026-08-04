import styles from "./pricing.module.css";
import { TRUST_BADGES } from "../../data/pricingPlans";

function ShieldCheckIcon() {
  return (
    <svg
      className={styles.trustIcon}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 2l6.5 2.6v4.6c0 4.2-2.8 7.6-6.5 8.8-3.7-1.2-6.5-4.6-6.5-8.8V4.6L10 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.2 10.1l1.9 1.9 3.7-3.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TrustBadges() {
  return (
    <div className={styles.trustRow}>
      {TRUST_BADGES.map((label) => (
        <div key={label} className={styles.trustItem}>
          <ShieldCheckIcon />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
