// Formatting helpers shared across the messaging UI — deliberately tiny
// and dependency-free (no date-fns/moment) since these are the only few
// formats the feature needs.

export function formatTime(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDayLabel(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d
    .toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    })
    .toUpperCase();
}

export function formatRelativeListTime(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return formatTime(d);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const URL_RE = /((https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?'")\]])/gi;

// Splits text into plain-string / {url} segments so a renderer can turn
// only the URL pieces into <a> tags — used by MessageBubble for the "URLs
// should be detected and displayed appropriately" requirement.
export function splitLinks(text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    if (start > lastIndex) parts.push({ text: text.slice(lastIndex, start) });
    const raw = match[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push({ url: href, text: raw });
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });
  return parts;
}

export function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(URL_RE);
  return match ? (match[0].startsWith("http") ? match[0] : `https://${match[0]}`) : null;
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}