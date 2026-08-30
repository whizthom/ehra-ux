// ── Pricing & subscription plan data ────────────────────────────────────────
//
// Single source of truth for the /pricing page (cards, comparison table,
// FAQ) AND for anything else that needs to reason about plan limits on the
// frontend (e.g. an "upgrade to add another business" banner). Keeping it
// here — instead of scattering ₦ figures and feature lists across JSX —
// means adding a future plan (Enterprise), running a promo price, or
// bumping a limit is a one-file data edit, not a hunt through components.
//
// Mirrors the backend's PlanType enum 1:1 — `id` is the value that gets
// sent to the API (see initializeCheckout in api/subscriptionApi.js), so
// it must stay in sync with that enum's names exactly.
//
// IMPORTANT — backend sync status as of this edit (frontend-only change):
//   - STARTER: free, no checkout call is ever made — safe as-is.
//   - PRO: backend's PlanType.PRO still charges whatever
//     com.Ehra.util.PlanLimits.priceNaira(PRO, cycle) returns today
//     (previously ₦5,000/mo). The checkout amount and the employee/branch
//     limits actually ENFORCED are 100% server-side (PlanLimits.java) —
//     this file only controls what's *displayed*. Until PlanLimits.java is
//     updated to ₦6,000/mo · 1 business · 18 employees · 0 branches, real
//     checkouts will still charge/enforce the OLD numbers.
//   - id: "PREMIUM" is reused for the plan now DISPLAYED as "Business" —
//     deliberately, since its price (₦12,000/mo) is unchanged from the old
//     Premium tier, so no new backend enum value is needed for the price
//     to be right. Its limits (50 employees incl. branches, 2 branches,
//     1 business) still need a PlanLimits.java update to be enforced.
//   - id: "ELITE" (₦30,000/mo) has NO backend PlanType yet. Clicking its
//     "Upgrade to Elite" button will hit initializeCheckout, which the
//     backend won't recognize, and the user will see the generic
//     "Checkout isn't available yet — please try again shortly." error
//     from Pricing.jsx. A backend PlanType.ELITE + PlanLimits entry is
//     required before this tier can actually be purchased.
//   - Custom has no `id` used for checkout — its CTA (action: "contact")
//     sends the person to /support instead of initializeCheckout.
//
// Yearly prices below follow the same "2 months free" convention as the
// original Pro/Premium figures (yearly = monthly × 10) since no yearly
// price was specified for the new tiers — adjust here if a different
// yearly discount is wanted.

export const PLAN_IDS = {
  STARTER: "STARTER",
  PRO: "PRO",
  BUSINESS: "PREMIUM", // reuses the existing backend enum value — see note above
  ELITE: "ELITE", // not yet a real backend PlanType — see note above
  CUSTOM: "CUSTOM", // contact-only, never sent to the checkout API
};

export const BILLING_CYCLES = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
};

// Naira formatter — ₦5,000 not ₦5000. `notation: "standard"` is the
// default but stated explicitly since it's easy to accidentally reach for
// "compact" (which would render ₦5K) when copy-pasting formatter configs.
const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  notation: "standard",
});

export function formatNaira(amount) {
  return nairaFormatter.format(amount);
}

export const PLANS = [
  {
    id: PLAN_IDS.STARTER,
    name: "Starter",
    tagline: "Perfect for small businesses getting started.",
    badge: null,
    theme: "light",
    price: { MONTHLY: 0, YEARLY: 0 },
    savingsAmount: { MONTHLY: 0, YEARLY: 0 },
    cta: { label: "Start Free", action: "signup" },
    features: [
      "1 business",
      "Up to 10 employees",
      "Unlimited personal employee accounts",
      "Attendance management",
      "Employee management",
      "Leave management",
      "Employee messaging",
      "Announcements",
      "Unlimited business reports",
      "Phone number login",
      "QR attendance (if enabled)",
      "Core business management tools",
      "Unlimited penalty deductions",
    ],
  },
  {
    id: PLAN_IDS.PRO,
    name: "Pro",
    tagline: "For a single business ready to grow.",
    badge: null,
    theme: "light",
    price: { MONTHLY: 6000, YEARLY: 60000 },
    savingsAmount: { MONTHLY: 0, YEARLY: 12000 },
    cta: { label: "Upgrade to Pro", action: "checkout" },
    features: [
      "1 business",
      "Up to 18 employees",
      "No branches",
      "Unlimited personal employee accounts",
      "Unlimited reports",
      "Unlimited messaging",
      "Unlimited penalty deductions",
      "Priority support",
      "Early access to new features",
      "Every future Pro feature",
    ],
  },
  {
    id: PLAN_IDS.BUSINESS,
    name: "Business",
    tagline: "More room to grow — branches included.",
    badge: "MOST POPULAR",
    theme: "light",
    highlight: true,
    price: { MONTHLY: 12000, YEARLY: 120000 },
    savingsAmount: { MONTHLY: 0, YEARLY: 24000 },
    cta: { label: "Upgrade to Business", action: "checkout" },
    features: [
      "1 business",
      "Up to 50 employees across the business and its branches",
      "Up to 2 branches",
      "Unlimited personal employee accounts",
      "Unlimited reports",
      "Unlimited messaging",
      "Unlimited penalty deductions",
      "Priority support",
      "Early access to new features",
      "Every future Pro feature",
    ],
  },
  {
    id: PLAN_IDS.ELITE,
    name: "Elite",
    tagline: "Multiple businesses, more room to scale.",
    badge: null,
    theme: "dark",
    price: { MONTHLY: 30000, YEARLY: 300000 },
    savingsAmount: { MONTHLY: 0, YEARLY: 60000 },
    cta: { label: "Upgrade to Elite", action: "checkout" },
    features: [
      "Up to 2 businesses",
      "Up to 50 employees per business",
      "Up to 3 branches per business",
      "Unlimited personal employee accounts",
      "Advanced analytics",
      "Future AI insights",
      "API access",
      "Premium priority support",
      "Future payroll integrations",
      "Future accounting integrations",
    ],
  },
  {
    id: PLAN_IDS.CUSTOM,
    name: "Custom",
    tagline: "Need something bigger? Let's talk.",
    badge: null,
    theme: "light",
    isCustom: true,
    price: { MONTHLY: null, YEARLY: null },
    savingsAmount: { MONTHLY: 0, YEARLY: 0 },
    cta: { label: "Contact Sales", action: "contact" },
    features: [
      "Tailored business & employee limits",
      "Custom branch structure",
      "Dedicated onboarding",
      "Custom integrations on request",
      "Dedicated account manager",
      "Priority support",
    ],
  },
];

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) ?? null;
}

export function priceFor(planId, cycle) {
  return getPlan(planId)?.price?.[cycle] ?? 0;
}

// ── Comparison table ────────────────────────────────────────────────────────
// `value` per plan is either `true`/`false` (renders a check/dash) or a
// short string (renders as-is, e.g. "80 / business"). Keyed by plan `id`,
// so PLAN_IDS.BUSINESS's row uses the "PREMIUM" key (see note above).
export const COMPARISON_ROWS = [
  {
    label: "Businesses",
    values: { STARTER: "1", PRO: "1", PREMIUM: "1", ELITE: "Up to 2", CUSTOM: "Custom" },
  },
  {
    label: "Employees",
    values: {
      STARTER: "10",
      PRO: "18",
      PREMIUM: "Up to 50 (incl. branches)",
      ELITE: "Up to 50 per business",
      CUSTOM: "Custom",
    },
  },
  {
    label: "Branches",
    values: { STARTER: "—", PRO: "—", PREMIUM: "Up to 2", ELITE: "Up to 3 per business", CUSTOM: "Custom" },
  },
  {
    label: "Personal employee accounts",
    values: { STARTER: "Unlimited", PRO: "Unlimited", PREMIUM: "Unlimited", ELITE: "Unlimited", CUSTOM: "Unlimited" },
  },
  {
    label: "Attendance management",
    values: { STARTER: true, PRO: true, PREMIUM: true, ELITE: true, CUSTOM: true },
  },
  {
    label: "Messaging",
    values: { STARTER: true, PRO: "Unlimited", PREMIUM: "Unlimited", ELITE: "Unlimited", CUSTOM: "Unlimited" },
  },
  {
    label: "Business reports",
    values: { STARTER: "Unlimited", PRO: "Unlimited", PREMIUM: "Unlimited", ELITE: "Unlimited", CUSTOM: "Unlimited" },
  },
  {
    label: "Leave management",
    values: { STARTER: true, PRO: true, PREMIUM: true, ELITE: true, CUSTOM: true },
  },
  {
    label: "Penalty deduction",
    values: { STARTER: "Unlimited", PRO: "Unlimited", PREMIUM: "Unlimited", ELITE: "Unlimited", CUSTOM: "Unlimited" },
  },
  {
    label: "Priority support",
    values: { STARTER: false, PRO: true, PREMIUM: true, ELITE: true, CUSTOM: true },
  },
  {
    label: "AI features",
    values: { STARTER: false, PRO: false, PREMIUM: false, ELITE: "Future", CUSTOM: "Future" },
  },
  {
    label: "API access",
    values: { STARTER: false, PRO: false, PREMIUM: false, ELITE: true, CUSTOM: true },
  },
  {
    label: "Payroll integrations",
    values: { STARTER: false, PRO: false, PREMIUM: false, ELITE: "Future", CUSTOM: "Future" },
  },
  {
    label: "Accounting integrations",
    values: { STARTER: false, PRO: false, PREMIUM: false, ELITE: "Future", CUSTOM: "Future" },
  },
];

export const TRUST_BADGES = [
  "Cancel anytime",
  "Secure payments powered by Paystack",
  "Upgrade or downgrade anytime",
  "No hidden charges",
];

export const FAQ_ITEMS = [
  {
    question: "Can I upgrade later?",
    answer: "Yes. Upgrade anytime without losing your data.",
  },
  {
    question: "Can I downgrade?",
    answer: "Yes. Downgrading only affects features above your new plan's limits.",
  },
  {
    question: "Will I lose my data?",
    answer: "No. Your businesses, employees, and records stay exactly as they are, no matter which plan you're on.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "Paystack supports cards, bank transfer, OPay, USSD, and other supported payment channels.",
  },
  {
    question: "What happens if my subscription expires?",
    answer:
      "Your account automatically returns to the Starter plan and all your data is kept exactly as it is. Paid-only features become unavailable until you renew. If your usage is above Starter's limits — for example more than 10 employees, or more than one business — nothing is deleted; those businesses simply become read-only until you upgrade again.",
  },
  {
    question: "What if none of these plans fit my business?",
    answer:
      "Reach out through Help & Support and we'll put together a Custom plan sized to your business, employee, and branch needs.",
  },
];