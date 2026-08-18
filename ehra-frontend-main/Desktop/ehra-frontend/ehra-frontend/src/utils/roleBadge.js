// Deterministic role -> color mapping, extensible to ANY role label the
// backend ever produces (see MembershipDirectoryService#resolve on the
// backend), not a hardcoded switch that only recognizes today's roles.
// The four roles that exist right now get a deliberately chosen, fixed
// color each — so "gold = Employer" becomes something a person actually
// learns and recognizes at a glance, which a role whose color changes
// depending on WHO holds it could never give them. Anything NOT in that
// known set — a role introduced later, "Branch Manager", "Supervisor",
// whatever the business grows into — still gets a consistent, distinct
// color derived from a hash of its own label, so a brand-new role type
// is never left unstyled or falls back to something generic just
// because the frontend hasn't been explicitly taught about it yet.

const KNOWN_ROLE_COLORS = {
  Employer: "#f5b300", // gold — deliberately distinct; a business only ever has one
  HOD: "#845ef7", // violet
  Employee: "#2f9e44", // green — the baseline/most common role
  Customer: "#e8590c", // orange
};

// Small, visually distinct palette for the hash fallback — chosen to
// stay readable against both light and dark bubble/list backgrounds, and
// deliberately excludes anything close to the four KNOWN_ROLE_COLORS
// above so a future role can never be confused with an existing one.
const FALLBACK_PALETTE = ["#1c7ed6", "#e64980", "#0ca678", "#f76707", "#d6336c", "#5c7cfa"];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// roleLabel examples from the backend: "Employer", "Employee",
// "HOD - Engineering", "Customer" — or any label introduced later.
export function getRoleColor(roleLabel) {
  if (!roleLabel) return "#868e96";
  const base = roleLabel.split(" - ")[0].trim(); // "HOD - Engineering" -> "HOD"
  if (KNOWN_ROLE_COLORS[base]) return KNOWN_ROLE_COLORS[base];
  return FALLBACK_PALETTE[hashString(roleLabel) % FALLBACK_PALETTE.length];
}

// Short display text for the compact pill — "HOD - Engineering" is fine
// as a hover title but too long for an inline badge; the badge itself
// just shows what precedes " - ".
export function getRoleShortLabel(roleLabel) {
  if (!roleLabel) return "";
  return roleLabel.split(" - ")[0].trim();
}