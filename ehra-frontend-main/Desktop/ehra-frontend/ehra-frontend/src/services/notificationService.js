/**
 * Centralised in-app notification audio for Ehral.
 *
 * Uses one Web Audio context rather than creating Audio elements for each
 * event. This means it is safe during bursts of notifications and continues
 * to work if optional sound files are not deployed. Browser permission for
 * audio is acquired only after a real user interaction.
 */
const STORAGE_KEY = "ehral:notification-sound-preferences";
const DEFAULTS = Object.freeze({
  enabled: true,
  messages: true,
  general: true,
  employee: true,
  financial: true,
  important: true,
});

let audioContext;
let unlocked = false;
const recentlyPlayed = new Map();

function isBrowser() {
  return typeof window !== "undefined";
}

function context() {
  if (!isBrowser()) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext || audioContext.state === "closed")
    audioContext = new AudioContext();
  return audioContext;
}

export function getNotificationSoundPreferences() {
  if (!isBrowser()) return DEFAULTS;
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return DEFAULTS;
  }
}

export function setNotificationSoundPreferences(next) {
  const value = { ...getNotificationSoundPreferences(), ...next };
  if (isBrowser()) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

/** Call from an existing click/tap/login interaction; it never prompts. */
export async function unlockNotificationSounds() {
  const ctx = context();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = ctx.state === "running";
  } catch {
    unlocked = false;
  }
  return unlocked;
}

function categoryFor(notification) {
  const type = String(notification?.type || "").toUpperCase();
  if (
    notification?.kind === "message" ||
    type.includes("MESSAGE") ||
    type.includes("CHAT") ||
    type.includes("SUPPORT")
  )
    return "messages";
  if (
    type.includes("PAY") ||
    type.includes("PAYROLL") ||
    type.includes("PENALTY")
  )
    return "financial";
  if (
    type.includes("SECURITY") ||
    type.includes("CRITICAL") ||
    type.includes("ALERT")
  )
    return "important";
  if (
    type.includes("EMPLOYEE") ||
    type.includes("LEAVE") ||
    type.includes("ATTENDANCE") ||
    type.includes("PROFILE_EDIT")
  )
    return "employee";
  return "general";
}

function eventId(notification) {
  return (
    notification?.eventId ||
    notification?.id ||
    notification?.messageId ||
    `${notification?.type || notification?.kind || "notification"}:${notification?.createdAt || notification?.title || ""}`
  );
}

function tones(category) {
  switch (category) {
    case "messages":
      return [
        [660, 0],
        [880, 0.11],
      ];
    case "financial":
      return [
        [523, 0],
        [784, 0.1],
        [1046, 0.2],
      ];
    case "important":
      return [
        [740, 0],
        [740, 0.16],
        [988, 0.32],
      ];
    case "employee":
      return [
        [587, 0],
        [740, 0.12],
      ];
    default:
      return [
        [659, 0],
        [784, 0.12],
      ];
  }
}

/**
 * Plays one subtle, category-specific chime. Repeated delivery of the same
 * event (for example from multiple SSE consumers) is ignored for 15 seconds.
 */
export function playNotificationSound(notification) {
  const category = categoryFor(notification);
  const preferences = getNotificationSoundPreferences();
  if (!preferences.enabled || !preferences[category] || !unlocked) return false;

  const id = eventId(notification);
  const now = Date.now();
  if (recentlyPlayed.get(id) && now - recentlyPlayed.get(id) < 15000)
    return false;
  recentlyPlayed.set(id, now);
  for (const [key, time] of recentlyPlayed)
    if (now - time > 60000) recentlyPlayed.delete(key);

  const ctx = context();
  if (!ctx || ctx.state !== "running") return false;
  try {
    tones(category).forEach(([frequency, offset]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    return true;
  } catch {
    return false;
  }
}

export function playMessageSound(message) {
  return playNotificationSound({
    ...message,
    kind: "message",
    messageId: message?.id,
  });
}
