// Shared between PlanBadge (dashboard topbar pill) and PlanExpiryReminder
// (the periodic expiry toast) so "how urgent is this" is computed exactly
// one way, in exactly one place — the two surfaces read the same tier for
// the same subscription instead of two hand-tuned copies of the same
// day-count math quietly drifting apart over time.

export function daysUntil(dateString) {
  if (!dateString) return null;
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * @returns {"safe"|"upcoming"|"soon"|"urgent"|null} null means "not on a
 *   paid plan, or no expiry to worry about" — nothing should escalate.
 */
export function urgencyTier(subscription) {
  if (!subscription) return null;
  if (subscription.plan === "STARTER") return null;
  if (subscription.status !== "ACTIVE") return null;

  const days = daysUntil(subscription.expiryDate);
  if (days === null) return null;

  if (days > 14) return "safe";
  if (days > 7) return "upcoming"; // 8–14 days
  if (days > 3) return "soon"; // 4–7 days
  return "urgent"; // 0–3 days (including "today"/overdue-but-not-yet-reverted)
}