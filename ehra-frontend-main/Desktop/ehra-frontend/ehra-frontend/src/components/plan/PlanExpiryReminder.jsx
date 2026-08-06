import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./planExpiryReminder.module.css";
import { urgencyTier, daysUntil } from "./planUrgency";

const STORAGE_KEY = "ehra:planExpiryReminder:lastShown";

// How long the toast stays visible before auto-dismissing.
const AUTO_DISMISS_MS = 14_000;

// How often this is allowed to reappear, per urgency tier — deliberately
// escalating: a renewal 10 days out only needs a once-a-day nudge, but
// the last 3 days get a nudge every 6 hours since that's the window
// where "I'll deal with it later" actually risks the plan lapsing.
// "safe"/null are absent here on purpose — see shouldShow() below,
// they never show at all.
const COOLDOWN_MS = {
  upcoming: 24 * 60 * 60 * 1000, // 8–14 days out: once a day
  soon: 12 * 60 * 60 * 1000, // 4–7 days out: twice a day
  urgent: 6 * 60 * 60 * 1000, // 0–3 days out: every 6 hours
};

const TIER_COPY = {
  upcoming: {
    icon: "ti-calendar-time",
    heading: "Renewal coming up",
  },
  soon: {
    icon: "ti-clock",
    heading: "Renewal is close",
  },
  urgent: {
    icon: "ti-alert-triangle",
    heading: "Renew before you lose access",
  },
};

function readLastShown() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function shouldShow(tier) {
  if (!tier || tier === "safe") return false;
  const gap = COOLDOWN_MS[tier];
  const elapsed = Date.now() - readLastShown();
  return elapsed >= gap;
}

/**
 * Mount once near the top of Dashboard. Renders nothing until a paid,
 * ACTIVE subscription is within 14 days of expiryDate AND enough time has
 * passed since it was last shown (see COOLDOWN_MS) — so this nudges
 * periodically as renewal approaches rather than nagging on every single
 * page load. Recording "last shown" happens the instant it appears, not
 * on dismiss, so refreshing the page mid-cooldown doesn't reset the timer.
 */
export default function PlanExpiryReminder({ subscription }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const dismissTimerRef = useRef(null);

  useEffect(() => {
    const tier = urgencyTier(subscription);
    if (!shouldShow(tier)) return;

    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(true);

    dismissTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(dismissTimerRef.current);
    // Re-evaluate whenever the subscription object identity changes (a
    // fresh fetch) — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription]);

  if (!visible) return null;

  const tier = urgencyTier(subscription);
  const days = Math.max(daysUntil(subscription.expiryDate), 0);
  const copy = TIER_COPY[tier];
  const planLabel = subscription.plan === "PREMIUM" ? "Premium" : "Pro";

  function handleClose() {
    window.clearTimeout(dismissTimerRef.current);
    setVisible(false);
  }

  function handleRenew() {
    window.clearTimeout(dismissTimerRef.current);
    setVisible(false);
    navigate("/pricing");
  }

  return (
    <div className={`${styles.toast} ${styles[tier]}`} role="status">
      <div className={styles.toastIcon}>
        <i className={`ti ${copy.icon}`} aria-hidden="true" />
      </div>

      <div className={styles.toastBody}>
        <p className={styles.toastHeading}>{copy.heading}</p>
        <p className={styles.toastMessage}>
          Your {planLabel} plan renews in{" "}
          <strong>
            {days} day{days === 1 ? "" : "s"}
          </strong>
          . Renew now to keep everything running without interruption.
        </p>
        <div className={styles.toastActions}>
          <button
            type="button"
            className={styles.renewBtn}
            onClick={handleRenew}
          >
            Renew now
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={handleClose}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        className={styles.closeBtn}
        onClick={handleClose}
        aria-label="Dismiss"
      >
        <i className="ti ti-x" aria-hidden="true" />
      </button>

      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} />
      </div>
    </div>
  );
}
