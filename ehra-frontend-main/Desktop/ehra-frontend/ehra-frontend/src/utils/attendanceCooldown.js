const COOLDOWN_MS = 3 * 60 * 1000;
const STORAGE_PREFIX = "ehral:attendance-cooldown:";

function storageKey(membershipId) {
  return `${STORAGE_PREFIX}${membershipId || "default"}`;
}

export function getAttendanceCooldownRemaining(membershipId, now = Date.now()) {
  try {
    const raw = localStorage.getItem(storageKey(membershipId));
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= now) {
      if (raw !== null) localStorage.removeItem(storageKey(membershipId));
      return 0;
    }
    return until - now;
  } catch {
    return 0;
  }
}

export function startAttendanceCooldown(membershipId, timestamp) {
  const base = timestamp ? new Date(timestamp).getTime() : Date.now();
  const safeBase = Number.isFinite(base) ? Math.min(base, Date.now()) : Date.now();
  const until = safeBase + COOLDOWN_MS;
  try {
    localStorage.setItem(storageKey(membershipId), String(until));
  } catch {
    // The backend remains authoritative if browser storage is unavailable.
  }
  return Math.max(0, until - Date.now());
}

export function formatAttendanceCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export { COOLDOWN_MS };
