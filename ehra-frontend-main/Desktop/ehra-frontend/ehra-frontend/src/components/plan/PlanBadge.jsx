import styles from "./planBadge.module.css";
import { urgencyTier, daysUntil } from "./planUrgency";

const PLAN_META = {
  STARTER: { label: "Starter", className: styles.starter },
  PRO: { label: "Pro", className: styles.pro },
  PREMIUM: { label: "Premium", className: styles.premium },
};

/**
 * Two independent color signals, deliberately layered rather than merged
 * into one palette:
 *  - Which plan you're on (Starter/Pro/Premium) — a calm, permanent
 *    identity color per tier, so at a glance you know what you're paying
 *    for without reading the label.
 *  - How urgent renewal is (safe → upcoming → soon → urgent) — an
 *    overlay that only ever appears on a paid plan nearing its expiry,
 *    fading the badge from its normal color toward amber and finally a
 *    gently pulsing red. Starter never shows this since it never expires.
 *
 * Clicking it goes straight to /pricing — the badge doubles as the
 * fastest path to actually do something about what it's showing you.
 */
export default function PlanBadge({ subscription, loading, onClick }) {
  if (loading || !subscription) {
    return <div className={styles.skeleton} aria-hidden="true" />;
  }

  const meta = PLAN_META[subscription.plan] ?? PLAN_META.STARTER;
  const tier = urgencyTier(subscription);
  const days = tier ? daysUntil(subscription.expiryDate) : null;

  const urgencyClass =
    tier === "upcoming"
      ? styles.tierUpcoming
      : tier === "soon"
        ? styles.tierSoon
        : tier === "urgent"
          ? styles.tierUrgent
          : "";

  return (
    <button
      type="button"
      className={`${styles.badge} ${meta.className} ${urgencyClass}`}
      onClick={onClick}
      title={
        tier && tier !== "safe"
          ? `${meta.label} plan — renews in ${Math.max(days, 0)} day${days === 1 ? "" : "s"}. Click to manage.`
          : `${meta.label} plan — click to view plans.`
      }
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{meta.label}</span>
      {tier && tier !== "safe" && (
        <span className={styles.daysLeft}>{Math.max(days, 0)}d</span>
      )}
    </button>
  );
}
