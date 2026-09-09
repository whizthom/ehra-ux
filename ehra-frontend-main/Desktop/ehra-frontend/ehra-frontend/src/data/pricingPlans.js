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
// Backend sync status: fully wired up. STARTER/PRO/PREMIUM/ELITE all
// exist as backend PlanType values with matching prices AND enforced
// limits in PlanLimits.java (maxBusinesses, maxEmployeesPerBusiness,
// maxBranchesPerBusiness — see PlanLimitService for where each is
// actually checked). id: "PREMIUM" is deliberately reused for the plan
// DISPLAYED here as "Business" — its price (₦12,000/mo) was already
// correct under the old Premium tier, so no new enum value was needed,
// just updated limits. Custom has no `id` used for checkout — its CTA
// (action: "contact") sends the person to /support instead of
// initializeCheckout.
//
// Yearly prices below follow the same "2 months free" convention as the
// original Pro/Premium figures (yearly = monthly × 10) since no yearly
// price was specified for the new tiers — adjust here if a different
// yearly discount is wanted.

export const PLAN_IDS = {
  STARTER: "STARTER",
  PRO: "PRO",
  BUSINESS: "PREMIUM",
  ELITE: "ELITE",
  CUSTOM: "CUSTOM",
};

export const BILLING_CYCLES = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
};

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
    price: {
      MONTHLY: 0,
      YEARLY: 0,
    },
    savingsAmount: {
      MONTHLY: 0,
      YEARLY: 0,
    },
    cta: {
      label: "Start Free",
      action: "signup",
    },
    features: [
      "1 business",
      "Up to 5 employees",
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
      "Ehral AI assistant included",
    ],
  },

  {
    id: PLAN_IDS.PRO,
    name: "Pro",
    tagline: "For a single business ready to grow.",
    badge: null,
    theme: "light",
    price: {
      MONTHLY: 6000,
      YEARLY: 60000,
    },
    savingsAmount: {
      MONTHLY: 0,
      YEARLY: 12000,
    },
    cta: {
      label: "Upgrade to Pro",
      action: "checkout",
    },
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
      "Ehral AI assistant with higher daily usage",
    ],
  },

  {
    id: PLAN_IDS.BUSINESS,
    name: "Business",
    tagline: "More room to grow — branches included.",
    badge: "MOST POPULAR",
    theme: "light",
    highlight: true,
    price: {
      MONTHLY: 12000,
      YEARLY: 120000,
    },
    savingsAmount: {
      MONTHLY: 0,
      YEARLY: 24000,
    },
    cta: {
      label: "Upgrade to Business",
      action: "checkout",
    },
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
      "Ehral AI assistant with more daily usage",
    ],
  },

  {
    id: PLAN_IDS.ELITE,
    name: "Elite",
    tagline: "Multiple businesses, more room to scale.",
    badge: null,
    theme: "dark",
    price: {
      MONTHLY: 30000,
      YEARLY: 300000,
    },
    savingsAmount: {
      MONTHLY: 0,
      YEARLY: 60000,
    },
    cta: {
      label: "Upgrade to Elite",
      action: "checkout",
    },
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
      "Ehral AI assistant with the highest usage tier",
    ],
  },

  {
    id: PLAN_IDS.CUSTOM,
    name: "Custom",
    tagline: "Need something bigger? Let's talk.",
    badge: null,
    theme: "light",
    isCustom: true,
    price: {
      MONTHLY: null,
      YEARLY: null,
    },
    savingsAmount: {
      MONTHLY: 0,
      YEARLY: 0,
    },
    cta: {
      label: "Contact Sales",
      action: "contact",
    },
    features: [
      "Tailored business & employee limits",
      "Custom branch structure",
      "Dedicated onboarding",
      "Custom integrations on request",
      "Dedicated account manager",
      "Priority support",
      "Ehral AI assistant with tailored usage",
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

export const COMPARISON_ROWS = [
  {
    label: "Businesses",
    values: {
      STARTER: "1",
      PRO: "1",
      PREMIUM: "1",
      ELITE: "Up to 2",
      CUSTOM: "Custom",
    },
  },

  {
    label: "Employees",
    values: {
      STARTER: "5",
      PRO: "18",
      PREMIUM: "Up to 50 (incl. branches)",
      ELITE: "Up to 50 per business",
      CUSTOM: "Custom",
    },
  },

  {
    label: "Branches",
    values: {
      STARTER: "—",
      PRO: "—",
      PREMIUM: "Up to 2",
      ELITE: "Up to 3 per business",
      CUSTOM: "Custom",
    },
  },

  {
    label: "Personal employee accounts",
    values: {
      STARTER: "Unlimited",
      PRO: "Unlimited",
      PREMIUM: "Unlimited",
      ELITE: "Unlimited",
      CUSTOM: "Unlimited",
    },
  },

  {
    label: "Attendance management",
    values: {
      STARTER: true,
      PRO: true,
      PREMIUM: true,
      ELITE: true,
      CUSTOM: true,
    },
  },

  {
    label: "Messaging",
    values: {
      STARTER: true,
      PRO: "Unlimited",
      PREMIUM: "Unlimited",
      ELITE: "Unlimited",
      CUSTOM: "Unlimited",
    },
  },

  {
    label: "Business reports",
    values: {
      STARTER: "Unlimited",
      PRO: "Unlimited",
      PREMIUM: "Unlimited",
      ELITE: "Unlimited",
      CUSTOM: "Unlimited",
    },
  },

  {
    label: "Leave management",
    values: {
      STARTER: true,
      PRO: true,
      PREMIUM: true,
      ELITE: true,
      CUSTOM: true,
    },
  },

  {
    label: "Penalty deduction",
    values: {
      STARTER: "Unlimited",
      PRO: "Unlimited",
      PREMIUM: "Unlimited",
      ELITE: "Unlimited",
      CUSTOM: "Unlimited",
    },
  },

  {
    label: "Priority support",
    values: {
      STARTER: false,
      PRO: true,
      PREMIUM: true,
      ELITE: true,
      CUSTOM: true,
    },
  },

  {
    label: "Ehral AI assistant",
    values: {
      STARTER: "Included",
      PRO: "Higher daily usage",
      PREMIUM: "More daily usage",
      ELITE: "Highest usage tier",
      CUSTOM: "Tailored usage",
    },
  },

  {
    label: "API access",
    values: {
      STARTER: false,
      PRO: false,
      PREMIUM: false,
      ELITE: true,
      CUSTOM: true,
    },
  },

  {
    label: "Payroll integrations",
    values: {
      STARTER: false,
      PRO: false,
      PREMIUM: false,
      ELITE: "Future",
      CUSTOM: "Future",
    },
  },

  {
    label: "Accounting integrations",
    values: {
      STARTER: false,
      PRO: false,
      PREMIUM: false,
      ELITE: "Future",
      CUSTOM: "Future",
    },
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
    answer:
      "Yes. Upgrade anytime without losing your data.",
  },

  {
    question: "Can I downgrade?",
    answer:
      "Yes. Downgrading only affects features above your new plan's limits.",
  },

  {
    question: "Will I lose my data?",
    answer:
      "No. Your businesses, employees, and records stay exactly as they are, no matter which plan you're on.",
  },

  {
    question: "Which payment methods are supported?",
    answer:
      "Paystack supports cards, bank transfer, OPay, USSD, and other supported payment channels.",
  },

  {
    question: "What happens if my subscription expires?",
    answer:
      "Your account automatically returns to the Starter plan and all your data is kept exactly as it is. Paid-only features become unavailable until you renew. If your usage is above Starter's limits — for example more than 5 employees, or more than one business — nothing is deleted; those businesses simply become read-only until you upgrade again.",
  },

  {
    question: "What if none of these plans fit my business?",
    answer:
      "Reach out through Help & Support and we'll put together a Custom plan sized to your business, employee, and branch needs.",
  },
];