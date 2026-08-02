/**
 * Deletes the Cache Storage bucket the service worker uses for offline
 * GET /api responses (see the `api-get-cache` runtime-caching rule in
 * vite.config.js). Call this on logout.
 *
 * Why this needs to exist at all: the whole point of that cache is
 * "recently visited pages still work offline" — which necessarily means
 * responses like the employee list, attendance records, salary figures,
 * etc. are sitting in on-device storage, keyed by URL, independent of
 * whether the access token that originally fetched them is still valid.
 * Logging out clears localStorage (see clearTokens in api/authApi.js)
 * but was never wired up to clear this — meaning on a shared device
 * (a front-desk tablet, an office computer used by more than one admin)
 * the next person to log in could briefly see a stale response from the
 * previous session's cache before the network request overwrites it,
 * or read it directly via devtools after the fact. This closes that gap.
 *
 * Safe to call from anywhere, including browsers without the Cache
 * Storage API (older Safari, private-browsing edge cases) or before the
 * service worker has ever registered — both just no-op.
 */
export async function clearApiCache() {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete("api-get-cache");
  } catch {
    // Best-effort — a failure here shouldn't block logout.
  }
}