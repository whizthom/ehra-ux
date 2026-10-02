// Presentation helpers for Ehral Credits. The backend owns all amounts; this only formats them.
export const formatCredits = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

// Low-balance display tiers. Thresholds come from the backend when it provides them
// (dashboard.lowBalanceThreshold / criticalBalanceThreshold); otherwise we fall back to a neutral default.
export function creditTier(credits) {
  if (!credits) return "unknown";
  const total = Number(credits.availableCredits || 0);
  const critical = Number(credits.criticalBalanceThreshold ?? 50);
  const low = Number(credits.lowBalanceThreshold ?? 200);
  if (total <= 0) return "exhausted";
  if (total <= critical) return "critical";
  if (total <= low) return "low";
  return "healthy";
}
