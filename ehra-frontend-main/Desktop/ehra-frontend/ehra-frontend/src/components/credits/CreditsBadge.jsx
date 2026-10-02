import styles from "./creditsBadge.module.css";
import { creditTier, formatCredits } from "./creditsFormat";

/** Topbar pill showing available Ehral Credits. Clicking it opens the Credits page. */
export default function CreditsBadge({ credits, loading, onClick }) {
  if (loading || !credits) return <span className={styles.skeleton} aria-hidden="true" />;
  const tier = creditTier(credits);
  // With a live agreement the business is not being charged for covered services, so say so up front;
  // the Credit balance remains in the tooltip and on the Credits page.
  const onAgreement = credits.commercialStatus === "AGREEMENT_ACTIVE";
  return (
    <button
      type="button"
      className={`${styles.badge} ${onAgreement ? styles.healthy : styles[tier] || ""}`}
      onClick={onClick}
      title={onAgreement ? `Business Agreement active · Credits ${formatCredits(credits.availableCredits)}` : "Ehral Credits"}
      aria-label={`Ehral Credits: ${formatCredits(credits.availableCredits)} available`}
    >
      <i className={`ti ${onAgreement ? "ti-certificate" : "ti-coin"}`} aria-hidden="true" />
      <span>{onAgreement ? "Agreement" : formatCredits(credits.availableCredits)}</span>
    </button>
  );
}
