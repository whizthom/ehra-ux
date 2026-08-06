import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import styles from "./ThemeToggleMenu.module.css";
import planStyles from "../components/plan/planBadge.module.css";
import { urgencyTier, daysUntil } from "../components/plan/planUrgency";

// Must match the CSS transition duration on .panel/.scrim below — the
// panel stays mounted for exactly this long after closing so it can
// actually play the slide-out-to-the-left animation instead of just
// vanishing.
const CLOSE_DURATION = 260;

const PLAN_LABEL = { STARTER: "Starter", PRO: "Pro", PREMIUM: "Premium" };

// ── Settings icon + dropdown ─────────────────────────────────────────────
// Self-contained: drop <ThemeToggleMenu /> into any topbar and it Just
// Works with only the "Settings" category (theme toggle). Pages that also
// want the "My account" category (current plan + a link to Plans) pass
// `subscription`/`loadingSubscription`/`onViewPlans` — currently just
// Dashboard.jsx, since that's the only place plan info is meaningful. The
// account category only ever renders on mobile/tablet (see
// .accountSection's media query below); on desktop the same information
// already lives directly in that page's topbar via PlanBadge, so showing
// it twice would be redundant.
export default function ThemeToggleMenu({
  subscription,
  loadingSubscription,
  onViewPlans,
}) {
  const { theme, toggleTheme } = useTheme();
  // `mounted` = the panel exists in the DOM at all; `open` = it's in its
  // docked (visible) position. Splitting these lets the panel render
  // briefly in its off-screen position while closing, so it can slide
  // back out to the left instead of just disappearing.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimerRef = useRef(null);

  const hasAccountSection = typeof onViewPlans === "function";

  const openPanel = () => {
    clearTimeout(closeTimerRef.current);
    setMounted(true);
    // Mount off-screen first, then flip to the open position on the
    // next frame so the browser animates the transform instead of
    // snapping straight to it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(true));
    });
  };

  const closePanel = () => {
    setOpen(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setMounted(false), CLOSE_DURATION);
  };

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closePanel();
      }
    }
    if (mounted) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mounted]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  const tier = hasAccountSection ? urgencyTier(subscription) : null;
  const days = tier ? daysUntil(subscription.expiryDate) : null;
  const planMeta = subscription ? PLAN_LABEL[subscription.plan] : null;
  const planColorClass = subscription
    ? (planStyles[subscription.plan?.toLowerCase()] ?? planStyles.starter)
    : "";
  const tierClass =
    tier === "upcoming"
      ? planStyles.tierUpcoming
      : tier === "soon"
        ? planStyles.tierSoon
        : tier === "urgent"
          ? planStyles.tierUrgent
          : "";

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.iconBtn} ${open ? styles.iconBtnActive : ""}`}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label="Settings"
        title="Settings"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <i className="ti ti-dots-vertical" aria-hidden="true" />
      </button>

      {mounted && (
        <>
          {/* Soft scrim so the flyout reads as a distinct layer on top
              of the page — tap anywhere on it to dismiss, same as the
              outside-click listener above but with a visible cue. */}
          <div
            className={`${styles.scrim} ${open ? styles.scrimIn : ""}`}
            aria-hidden="true"
            onClick={closePanel}
          />
          <div
            className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
            role="menu"
          >
            <div className={styles.panelHdr}>
              <span className={styles.panelTitle}>
                {hasAccountSection ? "Menu" : "Settings"}
              </span>
              <button
                type="button"
                className={styles.panelClose}
                onClick={closePanel}
                aria-label="Close menu"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {hasAccountSection && (
              <div className={styles.accountSection}>
                <div className={styles.sectionLabel}>My account</div>

                {loadingSubscription || !subscription ? (
                  <div className={styles.row}>
                    <span className={styles.planSkeleton} aria-hidden="true" />
                  </div>
                ) : (
                  <div className={styles.row}>
                    <span className={styles.rowLabelGroup}>
                      <span
                        className={`${planStyles.dot} ${planColorClass} ${styles.planDot}`}
                        aria-hidden="true"
                      />
                      <span className={styles.rowLabel}>{planMeta} plan</span>
                    </span>
                    {tier && tier !== "safe" && (
                      <span
                        className={`${planStyles.daysLeft} ${tierClass} ${styles.planDaysChip}`}
                      >
                        {Math.max(days, 0)}d left
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    closePanel();
                    onViewPlans();
                  }}
                >
                  <i className="ti ti-credit-card" aria-hidden="true" />
                  <span>Plans</span>
                  <i
                    className="ti ti-chevron-right"
                    aria-hidden="true"
                    style={{ marginLeft: "auto", fontSize: 13 }}
                  />
                </button>
              </div>
            )}

            <div
              className={hasAccountSection ? styles.settingsSection : undefined}
            >
              {hasAccountSection && (
                <div className={styles.sectionLabel}>Settings</div>
              )}

              <div className={styles.row}>
                <span className={styles.rowLabelGroup}>
                  <i
                    className={`ti ${theme === "dark" ? "ti-moon-stars" : "ti-sun"}`}
                    aria-hidden="true"
                  />
                  <span className={styles.rowLabel}>
                    {theme === "dark" ? "Dark mode" : "Light mode"}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === "dark"}
                  aria-label="Toggle dark mode"
                  className={`${styles.switch} ${theme === "dark" ? styles.switchOn : ""}`}
                  onClick={toggleTheme}
                >
                  <span className={styles.knob} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
