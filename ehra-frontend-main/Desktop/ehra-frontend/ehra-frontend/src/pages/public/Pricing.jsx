import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo";
import BillingToggle from "../../components/pricing/BillingToggle";
import PricingCard from "../../components/pricing/PricingCard";
import ComparisonTable from "../../components/pricing/ComparisonTable";
import TrustBadges from "../../components/pricing/TrustBadges";
import FAQAccordion from "../../components/pricing/FAQAccordion";
import styles from "../../components/pricing/pricing.module.css";

import { PLANS, BILLING_CYCLES, PLAN_IDS } from "../../data/pricingPlans";
import {
  initializeCheckout,
  verifyCheckout,
  payWithPaystack,
} from "../../api/subscriptionApi";

/**
 * /pricing — reachable only when signed in (see the ProtectedRoute wrapper
 * around this route in App.jsx). Any authenticated Identity can view it;
 * only an Employer/admin context can actually check out (enforced both
 * here and, for real, by the backend's /api/subscription/** being
 * admin-only — see SecurityConfig).
 *
 * Checkout flow:
 *   1. Starter's "Start Free" — there's nothing to pay for, so this just
 *      returns them to the dashboard rather than sending them anywhere
 *      signup-shaped (they already have an account, that's how they got
 *      here).
 *   2. Pro/Premium, signed in but NOT in an admin/employer context (e.g.
 *      viewing as an employee): nothing to check out from here either —
 *      sends them back to the dashboard rather than attempting a request
 *      the backend would reject anyway.
 *   3. Pro/Premium, signed in as an admin: initialize a checkout on the
 *      backend, open the real Paystack popup, then verify the transaction
 *      server-side before treating it as paid. Never trusts the popup's
 *      own success callback alone.
 */
export default function Pricing() {
  const [cycle, setCycle] = useState(BILLING_CYCLES.MONTHLY);
  const [checkoutState, setCheckoutState] = useState({
    planId: null,
    loading: false,
    error: null,
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const isSignedInAdmin = user?.role === "ROLE_ADMIN";

  // ── Mobile card carousel ──────────────────────────────────────────────
  // Below 640px, .cardsGrid becomes a horizontal snap-scroller (see
  // pricing.module.css). The scrolling itself is pure CSS; this just
  // tracks which card is centered so the dots below can reflect and
  // control it — a small enhancement, not something the carousel depends
  // on to function. Defaults to Pro (index 1) since that's the card
  // worth landing on first.
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const [activeCardIndex, setActiveCardIndex] = useState(
    Math.max(
      PLANS.findIndex((p) => p.highlight),
      0,
    ),
  );

  useEffect(() => {
    const track = trackRef.current;
    const cards = cardRefs.current.filter(Boolean);
    if (!track || !cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce(
          (best, entry) =>
            entry.intersectionRatio > (best?.intersectionRatio ?? 0)
              ? entry
              : best,
          null,
        );
        if (mostVisible && mostVisible.intersectionRatio > 0.5) {
          const index = cards.indexOf(mostVisible.target);
          if (index !== -1) setActiveCardIndex(index);
        }
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  function scrollToCard(index) {
    cardRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  async function handleSelectPlan(plan) {
    setCheckoutState({ planId: plan.id, loading: false, error: null });

    if (plan.id === PLAN_IDS.STARTER) {
      navigate("/dashboard");
      return;
    }

    if (!isSignedInAdmin) {
      navigate("/dashboard");
      return;
    }

    setCheckoutState({ planId: plan.id, loading: true, error: null });
    try {
      const { reference, amount, email, publicKey } = await initializeCheckout(
        plan.id,
        cycle,
      );

      await payWithPaystack({
        email,
        amountNaira: amount ?? plan.price[cycle],
        reference,
        publicKey,
        onSuccess: async (confirmedReference) => {
          try {
            await verifyCheckout(confirmedReference);
            setCheckoutState({ planId: null, loading: false, error: null });
            navigate("/dashboard?upgraded=" + plan.id);
          } catch {
            setCheckoutState({
              planId: plan.id,
              loading: false,
              error:
                "Payment received but we couldn't confirm it automatically. Contact support and we'll sort it out.",
            });
          }
        },
        onClose: () => {
          setCheckoutState({ planId: null, loading: false, error: null });
        },
      });
    } catch {
      setCheckoutState({
        planId: plan.id,
        loading: false,
        error: "Checkout isn't available yet — please try again shortly.",
      });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Logo size={40} variant="horizontal" />
        <a href="/dashboard" className={styles.topbarLink}>
          Dashboard
        </a>
      </div>

      <header className={styles.header}>
        <span className={styles.eyebrow}>Pricing</span>
        <h1 className={styles.title}>
          Choose the plan that fits your business
        </h1>
        <p className={styles.subtitle}>
          Start free today. Upgrade only when your business grows.
        </p>
      </header>

      <BillingToggle cycle={cycle} onChange={setCycle} />

      <p className={styles.swipeHint} aria-hidden="true">
        <span className={styles.swipeArrow}>←</span>
        Swipe to compare plans
        <span className={styles.swipeArrow}>→</span>
      </p>

      <div className={styles.cardsGrid} ref={trackRef}>
        {PLANS.map((plan, index) => (
          <div
            key={plan.id}
            className={styles.cardSlide}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
          >
            <PricingCard
              plan={plan}
              cycle={cycle}
              loading={
                checkoutState.planId === plan.id && checkoutState.loading
              }
              error={
                checkoutState.planId === plan.id ? checkoutState.error : null
              }
              onSelect={handleSelectPlan}
            />
          </div>
        ))}
      </div>

      <div
        className={styles.cardDots}
        role="tablist"
        aria-label="Choose a plan to view"
      >
        {PLANS.map((plan, index) => (
          <button
            key={plan.id}
            type="button"
            role="tab"
            className={styles.cardDot}
            data-active={index === activeCardIndex}
            aria-selected={index === activeCardIndex}
            aria-label={`Show ${plan.name} plan`}
            onClick={() => scrollToCard(index)}
          />
        ))}
      </div>

      <ComparisonTable />
      <TrustBadges />
      <FAQAccordion />
    </div>
  );
}
