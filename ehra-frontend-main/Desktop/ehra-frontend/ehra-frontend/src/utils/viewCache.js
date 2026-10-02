// In-memory "show what we already have, refresh in the background" cache.
//
// Why this exists: the dashboards render one section at a time and UNMOUNT
// a section the moment you leave it. Coming back remounted it from scratch
// - empty state, spinner, refetch - so flipping Departments -> Workforce ->
// Departments paid a full loading screen every single time.
//
// How it is used (see hooks/useCacheWrite.js and seedFromCache below): a
// section seeds its state from here so it paints instantly, and STILL refetches on mount, so what
// the person sees is only ever stale for one round trip. This is purely a
// display cache - it is never used to decide anything and no screen skips
// its fetch because of it.
//
// Safety properties:
//  - Memory only. Nothing is written to localStorage/sessionStorage, so no
//    employee/salary data is left on the device at rest.
//  - Scoped to the logged-in identity + workspace (type, business,
//    membership). Another login or a workspace switch can never read it.
//  - Wiped on logout (clearTokens() in api/authApi.js calls clearViewCache).
//  - Bounded size.
//
// Deliberately has NO imports from api/authApi.js (authApi imports this
// file to clear it on logout; importing back would create a cycle), so the
// session scope is read straight from the same localStorage keys.

const MAX_ENTRIES = 300;
const store = new Map(); // scopedKey -> { value, at }

function scopePrefix() {
  try {
    return [
      localStorage.getItem("identityId") || "-",
      localStorage.getItem("contextType") || "-",
      localStorage.getItem("businessId") || "-",
      localStorage.getItem("membershipId") || "-",
    ].join("|");
  } catch {
    return "-|-|-|-";
  }
}

export function scopedKey(key) {
  return `${scopePrefix()}::${key}`;
}

/**
 * Returns the cached value, or undefined when there is none (or, when
 * maxAgeMs is given, when it is older than that).
 */
export function peekCache(key, maxAgeMs = Infinity) {
  const hit = store.get(scopedKey(key));
  if (!hit) return undefined;
  if (Date.now() - hit.at > maxAgeMs) return undefined;
  return hit.value;
}

/**
 * Initial value for a screen's useState: the cached copy when there is one
 * (optionally only if no older than maxAgeMs), otherwise `initial`.
 *   const [rows, setRows] = useState(() => seedFromCache("rows", []));
 */
export function seedFromCache(key, initial, maxAgeMs = Infinity) {
  const hit = peekCache(key, maxAgeMs);
  return hit !== undefined ? hit : initial;
}

export function hasCached(key) {
  return store.has(scopedKey(key));
}

/** True when a value exists AND is no older than maxAgeMs. */
export function hasFreshCache(key, maxAgeMs) {
  const hit = store.get(scopedKey(key));
  return Boolean(hit) && Date.now() - hit.at <= maxAgeMs;
}

/** Age in ms of the cached value, or Infinity when there is none. */
export function cacheAgeMs(key) {
  const hit = store.get(scopedKey(key));
  return hit ? Date.now() - hit.at : Infinity;
}

export function putCache(key, value) {
  const k = scopedKey(key);
  store.delete(k); // re-insert so the Map's order reflects recency
  store.set(k, { value, at: Date.now() });
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value); // evict oldest
  }
}

/** Drop one entry, or every entry whose key starts with `prefix`. */
export function invalidateCache(prefix) {
  const wanted = scopedKey(prefix);
  for (const k of [...store.keys()]) {
    if (k.startsWith(wanted)) store.delete(k);
  }
}

export function clearViewCache() {
  store.clear();
}
