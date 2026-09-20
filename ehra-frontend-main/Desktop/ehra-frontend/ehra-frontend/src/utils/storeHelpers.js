// Shared helpers for the customer-facing business pages
// (pages/CustomerBusinessView.jsx - the business profile - and
// pages/CustomerStore.jsx - the in-app store). Pure functions only, so both
// pages format money, stock, images and opening hours identically.

export const money = (currency, value) =>
  `${currency || "NGN"} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const initials = (name = "Ehral") =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase() || "E";

// ── Products ─────────────────────────────────────────────────────────

export const effectivePrice = (p) => {
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  return Math.max(0, price - (Number.isFinite(discount) ? discount : 0));
};

export const discountPercent = (p) => {
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  if (!(price > 0) || !(discount > 0)) return 0;
  return Math.min(99, Math.round((discount / price) * 100));
};

export const getCategory = (p) => {
  const raw = p?.category ?? p?.productCategory ?? p?.categoryName;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "Other products";
};

export const stockOf = (p) => {
  const raw = p?.stockQuantity;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : null;
};

export const isInStock = (p) => {
  const stock = stockOf(p);
  return stock !== null ? stock > 0 : Boolean(p?.available);
};

export const stockState = (p) => {
  const n = stockOf(p);
  if (n !== null) {
    if (n <= 0) return { label: "Out of stock", tone: "empty", quantity: 0 };
    const threshold = Number(p?.lowStockThreshold);
    if (Number.isFinite(threshold) && threshold > 0 && n <= threshold) {
      return { label: `Only ${n} left`, tone: "low", quantity: n };
    }
    return { label: "In stock", tone: "good", quantity: n };
  }
  return isInStock(p)
    ? { label: "Available", tone: "good", quantity: null }
    : { label: "Out of stock", tone: "empty", quantity: 0 };
};

export const imagesOf = (p) => {
  try {
    const parsed = p?.imagesJson ? JSON.parse(p.imagesJson) : [];
    if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
  } catch {
    /* fall back to imageUrl */
  }
  return p?.imageUrl ? [p.imageUrl] : [];
};

// ── Local persistence (cart / wishlist) ──────────────────────────────
// Same keys as the public storefront (pages/public/Storefront.jsx), so a bag
// started on the public page carries straight into the in-app store.

export const cartKey = (slug) => `ehral:storefront:cart:${slug || "unknown"}`;
export const wishlistKey = (slug) => `ehral:storefront:wishlist:${slug || "unknown"}`;

export const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private mode) - the bag just won't persist */
  }
};

// ── Opening hours ────────────────────────────────────────────────────
// Stored by the Retail Workspace as JSON: { monday: { open: "09:00", close: "18:00" }, ... }
// A day with no open/close is closed.

export const DAYS = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];

export function parseHours(value) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const toMinutes = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function formatTime12(t) {
  if (!t) return "";
  const [hRaw, mRaw] = String(t).split(":").map(Number);
  const h = hRaw || 0;
  const m = mRaw || 0;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Day index with Monday = 0, matching DAYS.
export const dayIndex = (date) => (date.getDay() + 6) % 7;

/**
 * Whether the business is open right now (in the viewer's local time - the
 * business's own time zone isn't stored), and when that next changes.
 * `known: false` when the business hasn't published any hours.
 */
export function openStatus(hoursJson, now = new Date()) {
  const hours = parseHours(hoursJson);
  const anyHours = DAYS.some(([k]) => hours[k]?.open && hours[k]?.close);
  if (!anyHours) return { known: false };

  const idx = dayIndex(now);
  const today = hours[DAYS[idx][0]];
  const yesterday = hours[DAYS[(idx + 6) % 7][0]];
  const mins = now.getHours() * 60 + now.getMinutes();

  // A late-night shift that started yesterday and runs past midnight.
  if (yesterday?.open && yesterday?.close) {
    const yo = toMinutes(yesterday.open);
    const yc = toMinutes(yesterday.close);
    if (yc <= yo && mins < yc) return { known: true, isOpen: true, closesAt: yesterday.close };
  }

  if (today?.open && today?.close) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    const overnight = c <= o;
    if (mins >= o && (overnight || mins < c)) return { known: true, isOpen: true, closesAt: today.close };
    if (mins < o) return { known: true, isOpen: false, opensAt: today.open, opensDay: "today" };
  }

  for (let i = 1; i <= 7; i += 1) {
    const [key, label] = DAYS[(idx + i) % 7];
    const next = hours[key];
    if (next?.open && next?.close) {
      return { known: true, isOpen: false, opensAt: next.open, opensDay: i === 1 ? "tomorrow" : label };
    }
  }
  return { known: true, isOpen: false };
}

export function openStatusLabel(status) {
  if (!status?.known) return "";
  if (status.isOpen) return `Open now · closes ${formatTime12(status.closesAt)}`;
  if (status.opensAt) return `Closed · opens ${status.opensDay} ${formatTime12(status.opensAt)}`;
  return "Closed";
}

// Share of today's opening window that has elapsed (0-1), for the little
// progress line under today's row. null when today has no hours.
export function todayProgress(hoursJson, now = new Date()) {
  const row = parseHours(hoursJson)[DAYS[dayIndex(now)][0]];
  if (!row?.open || !row?.close) return null;
  const o = toMinutes(row.open);
  let c = toMinutes(row.close);
  if (c <= o) c += 24 * 60;
  const mins = now.getHours() * 60 + now.getMinutes();
  return Math.min(1, Math.max(0, (mins - o) / (c - o)));
}

// ── Links ────────────────────────────────────────────────────────────

export const mapsLink = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;

// First sentence of a description, when the description is long enough that a
// short standfirst adds something (otherwise the About section says it all).
export function standfirst(description) {
  const text = String(description || "").trim();
  if (text.length < 150) return "";
  // No regex lookbehind here: a lookbehind is a parse-time SyntaxError on
  // Safari < 16.4, which would stop this whole module (and both business
  // pages that import it) from loading on older iPhones.
  const match = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const first = match ? match[0].trim() : "";
  if (first.length < 24 || first.length > 160) return "";
  return first;
}