import styles from "./pricing.module.css";
import { formatNaira } from "../../data/pricingPlans";

function CheckIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.14" />
      <path
        d="M6 10.2l2.4 2.4L14 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {object} plan - one entry from PLANS (src/data/pricingPlans.js)
 * @param {"MONTHLY"|"YEARLY"} cycle
 * @param {boolean} loading - true while this specific card's checkout is in flight
 * @param {string|null} error - checkout error message to show under the CTA
 * @param {(plan: object) => void} onSelect - called when the CTA is clicked
 */
export default function PricingCard({ plan, cycle, loading, error, onSelect }) {
  const price = plan.price[cycle];
  const savings = plan.savingsAmount[cycle];
  const isFree = price === 0;

  const cardClass = [
    styles.card,
    plan.highlight ? styles.cardHighlight : "",
    plan.theme === "dark" ? styles.cardDark : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ctaClass = [
    styles.ctaButton,
    plan.highlight || plan.theme === "dark" ? styles.ctaButtonPrimary : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass}>
      {plan.badge && <span className={styles.badge}>{plan.badge}</span>}

      <h3 className={styles.planName}>{plan.name}</h3>
      <p className={styles.planTagline}>{plan.tagline}</p>

      <div className={styles.priceRow}>
        <span className={styles.priceAmount}>
          {isFree ? "Free" : formatNaira(price)}
        </span>
        {!isFree && (
          <span className={styles.priceUnit}>
            /{cycle === "YEARLY" ? "year" : "month"}
          </span>
        )}
      </div>

      {savings > 0 ? (
        <span className={styles.savingsBadge}>
          Save {formatNaira(savings)} yearly
        </span>
      ) : (
        <div className={styles.priceSpacer} aria-hidden="true" />
      )}

      <button
        type="button"
        className={ctaClass}
        onClick={() => onSelect(plan)}
        disabled={loading}
      >
        {loading ? "Redirecting…" : plan.cta.label}
      </button>

      {error && <p className={styles.checkoutError}>{error}</p>}

      <ul className={styles.featureList}>
        {plan.features.map((feature) => (
          <li key={feature} className={styles.featureItem}>
            <CheckIcon className={styles.featureCheck} />
            <span className={styles.featureText}>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
