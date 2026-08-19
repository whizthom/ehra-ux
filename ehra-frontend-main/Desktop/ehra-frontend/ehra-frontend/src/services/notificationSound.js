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
  if (!audioContext || audioContext.state === "closed") audioContext = new AudioContext();
  return audioContext;
}

export function getNotificationSoundPreferences() {
  if (!isBrowser()) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
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
  if (notification?.kind === "message" || type.includes("MESSAGE") || type.includes("CHAT") || type.includes("SUPPORT")) return "messages";
  if (type.includes("PAY") || type.includes("PAYROLL") || type.includes("PENALTY")) return "financial";
  if (type.includes("SECURITY") || type.includes("CRITICAL") || type.includes("ALERT")) return "important";
  if (type.includes("EMPLOYEE") || type.includes("LEAVE") || type.includes("ATTENDANCE") || type.includes("PROFILE_EDIT")) return "employee";
  return "general";
}

function eventId(notification) {
  return notification?.eventId || notification?.id || notification?.messageId ||
    `${notification?.type || notification?.kind || "notification"}:${notification?.createdAt || notification?.title || ""}`;
}

/**
 * Each entry: [frequency, offset, duration, waveform]
 * - frequency: pitch in Hz
 * - offset: seconds after the chime starts
 * - duration: how long this note rings, in seconds
 * - waveform: oscillator type — "sine" (soft), "triangle" (warmer, a bit
 *   reedier), used together across notes so each chime has its own timbre
 *   instead of every category sounding like a plain beep.
 *
 * These are longer (4-5 notes, ~0.6-0.9s total) and more melodically
 * distinct per category than a simple two-note ping, so each one is
 * recognisable by ear without looking at the screen.
 */
function tones(category) {
  switch (category) {
    case "messages":
      // Bright, friendly rising triplet + a soft landing note.
      return [
        [660, 0.00, 0.14, "triangle"],
        [880, 0.10, 0.14, "triangle"],
        [1108, 0.20, 0.16, "sine"],
        [880, 0.36, 0.22, "sine"],
      ];
    case "financial":
      // A confident ascending arpeggio — deliberate, "cha-ching" feel.
      return [
        [392, 0.00, 0.15, "triangle"],
        [523, 0.12, 0.15, "triangle"],
        [659, 0.24, 0.15, "triangle"],
        [784, 0.36, 0.18, "sine"],
        [1046, 0.50, 0.28, "sine"],
      ];
    case "important":
      // Urgent double-pulse on one note, then a higher alert note — the
      // most attention-grabbing of the set.
      return [
        [740, 0.00, 0.13, "sine"],
        [740, 0.16, 0.13, "sine"],
        [740, 0.32, 0.13, "sine"],
        [988, 0.50, 0.32, "triangle"],
      ];
    case "employee":
      // Gentle two-step up-down, gives a "checked in" feel.
      return [
        [587, 0.00, 0.16, "sine"],
        [740, 0.14, 0.16, "triangle"],
        [659, 0.30, 0.16, "sine"],
        [880, 0.46, 0.24, "triangle"],
      ];
    default:
      // General notifications — neutral but still a short melodic phrase
      // rather than a flat beep.
      return [
        [659, 0.00, 0.13, "sine"],
        [784, 0.11, 0.13, "sine"],
        [988, 0.24, 0.20, "triangle"],
      ];
  }
}

/**
 * Plays one distinctive, category-specific chime. Repeated delivery of the
 * same event (for example from multiple SSE consumers) is ignored for 15
 * seconds.
 */
export function playNotificationSound(notification) {
  const category = categoryFor(notification);
  const preferences = getNotificationSoundPreferences();
  if (!preferences.enabled || !preferences[category] || !unlocked) return false;

  const id = eventId(notification);
  const now = Date.now();
  if (recentlyPlayed.get(id) && now - recentlyPlayed.get(id) < 15000) return false;
  recentlyPlayed.set(id, now);
  for (const [key, time] of recentlyPlayed) if (now - time > 60000) recentlyPlayed.delete(key);

  const ctx = context();
  if (!ctx || ctx.state !== "running") return false;
  try {
    // Peak gain per note. 1.0 is the loudest a note can go before the
    // waveform itself starts clipping into distortion — this is
    // effectively the maximum clean volume Web Audio supports.
    const PEAK_GAIN = 1.0;

    // A compressor squeezes the loud parts down and boosts the makeup
    // gain, which raises *perceived* loudness further without letting
    // the signal clip the way a raw gain multiplier above 1.0 would.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(12, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    const makeupGain = ctx.createGain();
    makeupGain.gain.setValueAtTime(2.5, ctx.currentTime);

    compressor.connect(makeupGain).connect(ctx.destination);

    tones(category).forEach(([frequency, offset, duration, waveform]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      const end = start + duration;

      oscillator.type = waveform || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain).connect(compressor);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
    return true;
  } catch {
    return false;
  }
}

export function playMessageSound(message) {
  return playNotificationSound({ ...message, kind: "message", messageId: message?.id });
}