import styles from "./pricing.module.css";
import { BILLING_CYCLES } from "../../data/pricingPlans";

/**
 * Monthly / Yearly switch. Purely controlled — the parent owns `cycle`
 * state so PricingCard, ComparisonTable, etc. can all react to it too.
 */
export default function BillingToggle({ cycle, onChange }) {
  const isYearly = cycle === BILLING_CYCLES.YEARLY;

  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleTrack} data-cycle={cycle}>
        <div className={styles.toggleThumb} aria-hidden="true" />
        <button
          type="button"
          className={styles.toggleOption}
          data-active={!isYearly}
          aria-pressed={!isYearly}
          onClick={() => onChange(BILLING_CYCLES.MONTHLY)}
        >
          Monthly
        </button>
        <button
          type="button"
          className={styles.toggleOption}
          data-active={isYearly}
          aria-pressed={isYearly}
          onClick={() => onChange(BILLING_CYCLES.YEARLY)}
        >
          Yearly
        </button>
      </div>
      <span className={styles.toggleSavingsPill}>
        Save up to ₦24,000 yearly
      </span>
    </div>
  );
}
