/**
 * Push-notification abstraction.
 *
 * This module intentionally does NOT talk to Firebase Cloud Messaging (or
 * any provider) yet — it exists so the rest of the app (Settings, the
 * install flow, EmployeeInbox, ChatPanel, etc.) can be wired against a
 * stable interface today, and swapping in a real FCM-backed
 * implementation later is a one-file change instead of a hunt through
 * every call site.
 *
 * How to wire up FCM later:
 *   1. `npm install firebase` — as of the Termii phone-auth migration,
 *      the repo no longer depends on the `firebase` package at all (see
 *      src/firebase-lazy.js), so this would be a fresh install, not a
 *      reuse of an existing initializeApp() instance.
 *   2. Implement `subscribe()` for real: call `getToken()` from
 *      "firebase/messaging" (guarded by the same `isSupported()` check
 *      used here), send the token to a new backend endpoint (e.g.
 *      POST /api/notifications/push-subscriptions), and return it.
 *   3. Implement `onMessage()` for real: call `onMessage()` from
 *      "firebase/messaging" and forward payloads to the same listener
 *      registry used below, so existing callers don't change.
 *   4. Register public/firebase-messaging-sw.js as FCM's background
 *      service worker (separate from the Workbox-generated PWA service
 *      worker registered in main.jsx — FCM requires its own file at a
 *      fixed path). vite-plugin-pwa's `injectManifest` strategy or a
 *      second `navigator.serviceWorker.register()` call both work; a
 *      second registration is simplest and keeps the two workers
 *      independent.
 *   5. Nothing outside this file needs to change.
 *
 * Until then, every method below is a safe, inert no-op (or a realistic
 * simulated response) so UI can be built and tested against it now.
 */

const STORAGE_KEY = "ehral:notificationSubscription";

/** Simple pub/sub so multiple components (e.g. a toast + a badge count)
 *  can both react to an incoming notification without polling. */
const listeners = new Set();

function isBrowserSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/**
 * Current permission state: "granted" | "denied" | "default", or
 * "unsupported" if this browser can't do push at all (e.g. some iOS
 * versions outside of an installed PWA).
 */
export function getPermissionState() {
  if (!isBrowserSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Asks the browser for notification permission. Must be called from a
 * user gesture (a button click), same as the install prompt — browsers
 * ignore/auto-deny permission requests fired on page load.
 */
export async function requestPermission() {
  if (!isBrowserSupported()) return "unsupported";
  return Notification.requestPermission();
}

/**
 * Subscribes the current device to push notifications and returns a
 * token/subscription identifier the backend can target.
 *
 * STUBBED: generates and persists a fake local token instead of calling
 * FCM, so UI that depends on "do we have a subscription yet?" works
 * end-to-end today. Replace the body per the FCM notes above; keep the
 * same return shape ({ token }) so callers don't need to change.
 */
export async function subscribe() {
  if (!isBrowserSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }
  if (Notification.permission !== "granted") {
    throw new Error("Notification permission has not been granted yet.");
  }

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return { token: existing };

  const token = `local-stub-${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEY, token);
  // TODO(FCM): POST { token } to the backend once that endpoint exists.
  return { token };
}

/** Removes the local subscription record. Pair with an FCM unsubscribe
 *  + backend delete call once those exist. */
export async function unsubscribe() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Whether this device currently holds a (stubbed) subscription. */
export function isSubscribed() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}

/**
 * Registers a listener for incoming push messages. Returns an unsubscribe
 * function — call it in a useEffect cleanup.
 *
 * STUBBED: nothing calls `listeners` yet since there's no real transport.
 * Once FCM's onMessage() is wired up, forward its payload here with
 * `listeners.forEach((fn) => fn(payload))` and every existing caller of
 * `onMessage()` starts receiving real pushes with no further changes.
 */
export function onMessage(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}