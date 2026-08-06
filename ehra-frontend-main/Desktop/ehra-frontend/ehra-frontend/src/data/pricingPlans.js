// ── Pricing & subscription plan data ────────────────────────────────────────
//
// Single source of truth for the /pricing page (cards, comparison table,
// FAQ) AND for anything else that needs to reason about plan limits on the
// frontend (e.g. an "upgrade to add another business" banner). Keeping it
// here — instead of scattering ₦ figures and feature lists across JSX —
// means adding a future plan (Enterprise), running a promo price, or
// bumping a limit is a one-file data edit, not a hunt through components.
//
// Mirrors the backend's Plan enum 1:1 (see PlanType on the backend once
// built) — `id` is the value that gets sent to the API, so it must stay in
// sync with that enum's names exactly.

export const PLAN_IDS = {
  STARTER: "STARTER",
  PRO: "PRO",
  PREMIUM: "PREMIUM",
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
      "Up to 20 employees",
      "Up to 2 personal employee accounts",
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
    tagline: "Designed for growing businesses.",
    badge: "MOST POPULAR",
    theme: "light",
    highlight: true,
    price: { MONTHLY: 5000, YEARLY: 50000 },
    savingsAmount: { MONTHLY: 0, YEARLY: 10000 },
    cta: { label: "Upgrade to Pro", action: "checkout" },
    features: [
      "Up to 5 businesses",
      "Up to 80 employees per business",
      "Up to 3 branches per business",
      "Up to 6 personal employee accounts",
      "Unlimited reports",
      "Unlimited messaging",
      "Unlimited penalty deductions",
      "Priority support",
      "Early access to new features",
      "Every future Pro feature",
    ],
  },
  {
    id: PLAN_IDS.PREMIUM,
    name: "Premium",
    tagline: "Built for businesses operating at scale.",
    badge: null,
    theme: "dark",
    price: { MONTHLY: 12000, YEARLY: 120000 },
    savingsAmount: { MONTHLY: 0, YEARLY: 24000 },
    cta: { label: "Go Premium", action: "checkout" },
    features: [
      "Unlimited businesses",
      "Up to 300 employees per business",
      "Unlimited branches",
      "Up to 20 personal employee accounts",
      "Advanced analytics",
      "Future AI insights",
      "API access",
      "Premium priority support",
      "Future payroll integrations",
      "Future accounting integrations",
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
// short string (renders as-is, e.g. "80 / business").
export const COMPARISON_ROWS = [
  {
    label: "Businesses",
    values: { STARTER: "1", PRO: "Up to 5", PREMIUM: "Unlimited" },
  },
  {
    label: "Employees per business",
    values: { STARTER: "20", PRO: "80", PREMIUM: "300" },
  },
  {
    label: "Branches per business",
    values: { STARTER: "—", PRO: "3", PREMIUM: "Unlimited" },
  },
  {
    label: "Personal employee accounts",
    values: { STARTER: "2", PRO: "6", PREMIUM: "20" },
  },
  { label: "Attendance management", values: { STARTER: true, PRO: true, PREMIUM: true } },
  { label: "Messaging", values: { STARTER: true, PRO: "Unlimited", PREMIUM: "Unlimited" } },
  { label: "Business reports", values: { STARTER: "Unlimited", PRO: "Unlimited", PREMIUM: "Unlimited" } },
  { label: "Leave management", values: { STARTER: true, PRO: true, PREMIUM: true } },
  {
    label: "Penalty deduction",
    values: { STARTER: "Unlimited", PRO: "Unlimited", PREMIUM: "Unlimited" },
  },
  { label: "Priority support", values: { STARTER: false, PRO: true, PREMIUM: true } },
  { label: "AI features", values: { STARTER: false, PRO: false, PREMIUM: "Future" } },
  { label: "API access", values: { STARTER: false, PRO: false, PREMIUM: true } },
  { label: "Payroll integrations", values: { STARTER: false, PRO: false, PREMIUM: "Future" } },
  { label: "Accounting integrations", values: { STARTER: false, PRO: false, PREMIUM: "Future" } },
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
      "Your account automatically returns to the Starter plan and all your data is kept exactly as it is. Premium-only features become unavailable until you renew. If your usage is above Starter's limits — for example more than 20 employees, or more than one business — nothing is deleted; those businesses simply become read-only until you upgrade again.",
  },
];