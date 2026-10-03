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

function readLs(name) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function scopePrefix() {
  return [
    readLs("identityId") || "-",
    readLs("contextType") || "-",
    readLs("businessId") || "-",
    readLs("membershipId") || "-",
  ].join("|");
}

// Keys starting with "identity:" describe the PERSON, not the workspace they
// are currently in (e.g. their list of accounts), so they are scoped by
// identity only and survive a workspace switch. If there is no identity id
// at all they get no scope and are never cached - an unscoped entry could
// otherwise be shared between two different logins.
const IDENTITY_PREFIX = "identity:";

export function scopedKey(key) {
  if (key.startsWith(IDENTITY_PREFIX)) {
    const id = readLs("identityId");
    return id ? `id:${id}::${key}` : null;
  }
  return `${scopePrefix()}::${key}`;
}

/**
 * Returns the cached value, or undefined when there is none (or, when
 * maxAgeMs is given, when it is older than that).
 */
export function peekCache(key, maxAgeMs = Infinity) {
  const k = scopedKey(key);
  const hit = k === null ? undefined : store.get(k);
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
  const k = scopedKey(key);
  return k !== null && store.has(k);
}

/** True when a value exists AND is no older than maxAgeMs. */
export function hasFreshCache(key, maxAgeMs) {
  const k = scopedKey(key);
  const hit = k === null ? undefined : store.get(k);
  return Boolean(hit) && Date.now() - hit.at <= maxAgeMs;
}

/** Age in ms of the cached value, or Infinity when there is none. */
export function cacheAgeMs(key) {
  const k = scopedKey(key);
  const hit = k === null ? undefined : store.get(k);
  return hit ? Date.now() - hit.at : Infinity;
}

// ── "Can this screen skip its on-open fetch?" ──────────────────────────────
//
// Screens normally re-fetch every time they open. For slow-changing
// structural lists (departments, branches, the employee directory) that is
// wasted work when the same data was fetched seconds ago. A screen may skip
// the fetch only if EVERY key it shows is younger than FRESH_SKIP_MS AND the
// person has not made any change anywhere since it was fetched. Any
// successful write request (POST/PUT/PATCH/DELETE, noted by the API client
// via markMutated) makes everything need a re-fetch again, so editing
// something in one screen can never leave another showing the old value.
// Changes made by OTHER people are picked up on the next open after the
// window - at most FRESH_SKIP_MS late.
export const FRESH_SKIP_MS = 20 * 1000;

// Ordering uses a strict counter, not timestamps, so a write and a re-fetch
// that land in the same millisecond can never be mistaken for each other:
// "fetched after the last write" is exact. (Timestamps are still kept for
// the age limits.)
let seq = 0;
let lastMutationSeq = 0;

export function markMutated() {
  lastMutationSeq = ++seq;
}

export function canSkipFetch(keys, maxAgeMs = FRESH_SKIP_MS) {
  const now = Date.now();
  return keys.every((key) => {
    const k = scopedKey(key);
    const hit = k === null ? undefined : store.get(k);
    return Boolean(hit) && now - hit.at <= maxAgeMs && hit.seq > lastMutationSeq;
  });
}

export function putCache(key, value) {
  const k = scopedKey(key);
  if (k === null) return;
  store.delete(k); // re-insert so the Map's order reflects recency
  store.set(k, { value, at: Date.now(), seq: ++seq });
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value); // evict oldest
  }
}

/** Drop one entry, or every entry whose key starts with `prefix`. */
export function invalidateCache(prefix) {
  const wanted = scopedKey(prefix);
  if (wanted === null) return;
  for (const k of [...store.keys()]) {
    if (k.startsWith(wanted)) store.delete(k);
  }
}

export function clearViewCache() {
  store.clear();
}
