import API from "../api/authApi";

const STORAGE_KEY = "ehral:webPushEndpoint";
const listeners = new Set();
const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function base64UrlToUint8Array(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function getPermissionState() { return supported() ? Notification.permission : "unsupported"; }
export async function requestPermission() { return supported() ? Notification.requestPermission() : "unsupported"; }

/** Invoke only after the user selects Enable Notifications. */
export async function subscribe() {
  if (!supported()) throw new Error("Push notifications are not supported in this browser.");
  if (Notification.permission !== "granted") throw new Error("Notification permission has not been granted.");
  const { data } = await API.get("/push/public-key");
  if (!data?.publicKey) throw new Error("Push notifications are not configured on this server.");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(data.publicKey) });
  const json = subscription.toJSON();
  const payload = { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } };
  await API.post("/push/subscriptions", payload);
  localStorage.setItem(STORAGE_KEY, payload.endpoint);
  return payload;
}

export async function unsubscribe() {
  if (!supported()) return;
  const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (subscription) {
    await API.delete("/push/subscriptions", { params: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
  localStorage.removeItem(STORAGE_KEY);
}

export async function isSubscribed() {
  return supported() && Boolean(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
}

export function onMessage(callback) { listeners.add(callback); return () => listeners.delete(callback); }

if (typeof navigator !== "undefined" && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "EHRAL_PUSH") listeners.forEach((callback) => callback(event.data.payload));
  });
}
