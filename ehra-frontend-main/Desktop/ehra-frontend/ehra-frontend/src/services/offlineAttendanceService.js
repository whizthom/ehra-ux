// Orchestrates offline attendance: decides whether offline clocking is
// available on this device right now, builds and signs a transaction
// when it is, and syncs the local queue once connectivity returns.
//
// This is the one module ScanAttendance.jsx should call into - it should
// never talk to offlineAttendanceJournal.js or attendanceDeviceCrypto.js
// directly, so there's exactly one place that decides what "recognized
// device" and "authorized offline" actually mean.

import { readSession } from "../api/authApi";
import {
  getAttendanceDeviceContext,
  getOrCreateAttendanceKeyPair,
  buildOfflineCanonicalPayload,
  toCanonicalLocalDateTime,
  sha256HexDigest,
  signOfflineTransaction,
} from "../utils/attendanceDeviceCrypto";
import {
  getLiveAuthorization,
  saveAuthorization,
  getNextChainLink,
  appendTransaction,
  getPendingTransactions,
  applySyncResults,
  countPending,
} from "./offlineAttendanceJournal";
import {
  getOfflineAttendanceStatus,
  syncOfflineAttendance,
} from "../api/offlineAttendanceApi";

// Reasons the UI needs to distinguish, matching the backend's rejection
// codes where one exists (spec §61) so a server-side sync rejection and a
// local pre-check land on the exact same message.
export const OFFLINE_BLOCK_REASON = {
  NO_LOCAL_DEVICE: "OFFLINE_DEVICE_NOT_AUTHORIZED",
  NOT_AUTHORIZED: "OFFLINE_AUTHORIZATION_EXPIRED",
  ACTION_NOT_ALLOWED: "OFFLINE_ACTION_NOT_ALLOWED",
};

function currentContext() {
  const session = readSession();
  const context = getAttendanceDeviceContext(session);

  if (!context.membershipId || !context.businessId) {
    throw new Error("No active employee session is available.");
  }

  return context;
}

/**
 * navigator.onLine only reflects the OS network interface, not whether
 * Ehral's API is actually reachable (spec §40 - a device can show
 * "online" while the API is unreachable, or vice versa on some captive
 * portals). A short, cheap authenticated request is the real signal;
 * this reuses the status endpoint itself rather than adding a dedicated
 * health-check call.
 */
export async function isServerReachable(deviceId) {
  if (!navigator.onLine) return false;

  try {
    await getOfflineAttendanceStatus(deviceId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Local-only check for immediate UI state (badge/button enablement) -
 * does not hit the network. The server re-validates everything again at
 * sync time regardless (spec §42), so a stale local "yes" here can never
 * turn into a real attendance record on its own.
 */
export async function getLocalOfflineAvailability() {
  const context = currentContext();
  const stored = await getOrCreateAttendanceKeyPair(context);

  if (!stored.deviceId) {
    return { available: false, reason: OFFLINE_BLOCK_REASON.NO_LOCAL_DEVICE };
  }

  const authorization = await getLiveAuthorization(context, stored.deviceId);
  if (!authorization) {
    return { available: false, reason: OFFLINE_BLOCK_REASON.NOT_AUTHORIZED };
  }

  return { available: true, expiresAt: authorization.expiresAt };
}

/**
 * Called right after a successful ONLINE clock-in/out response, if the
 * backend included an offline authorization in it - persists it locally
 * so it's available the next time this device goes offline. A response
 * with no authorization (e.g. device proof wasn't presented online, so
 * the backend never minted one) is a normal, expected case - nothing to
 * store.
 */
export async function captureOfflineAuthorization(authorization) {
  if (!authorization) return;
  const context = currentContext();
  await saveAuthorization(context, authorization);
}

/**
 * Builds, signs, and durably queues one offline clock-in/out. Throws
 * with a `.reason` matching OFFLINE_BLOCK_REASON if offline attendance
 * isn't actually available - the caller (ScanAttendance.jsx) is
 * responsible for showing the "Device not recognized" UI from spec §39
 * rather than a generic error.
 */
export async function recordOfflineAttendance(action, coords) {
  const context = currentContext();
  const stored = await getOrCreateAttendanceKeyPair(context);

  if (!stored.deviceId) {
    throw Object.assign(new Error("This device isn't recognized for offline attendance."), {
      reason: OFFLINE_BLOCK_REASON.NO_LOCAL_DEVICE,
    });
  }

  const authorization = await getLiveAuthorization(context, stored.deviceId);
  if (!authorization) {
    throw Object.assign(new Error("Offline attendance isn't authorized on this device right now."), {
      reason: OFFLINE_BLOCK_REASON.NOT_AUTHORIZED,
    });
  }

  if (!authorization.allowedActions?.includes(action)) {
    throw Object.assign(new Error(`Offline ${action.toLowerCase().replace("_", " ")} isn't allowed right now.`), {
      reason: OFFLINE_BLOCK_REASON.ACTION_NOT_ALLOWED,
    });
  }

  const { sequence, previousHash } = await getNextChainLink(context);
  const transactionId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clientCreatedAt = new Date();

  const canonicalPayload = buildOfflineCanonicalPayload({
    transactionId,
    businessId: context.businessId,
    membershipId: context.membershipId,
    deviceId: stored.deviceId,
    action,
    clientCreatedAt,
    sequence,
    previousHash,
    authorizationId: authorization.authorizationId,
  });

  const payloadHash = await sha256HexDigest(canonicalPayload);
  const signature = await signOfflineTransaction(stored.keyPair.privateKey, canonicalPayload);

  const transaction = {
    transactionId,
    deviceId: stored.deviceId,
    action,
    // The EXACT same string the payload was hashed/signed over - not
    // clientCreatedAt.toISOString(), which is UTC and would silently
    // desync from what was actually signed. See
    // toCanonicalLocalDateTime's doc.
    clientCreatedAt: toCanonicalLocalDateTime(clientCreatedAt),
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    accuracy: coords?.accuracy ?? null,
    sequence,
    previousHash,
    payloadHash,
    signature,
    authorizationId: authorization.authorizationId,
  };

  await appendTransaction(context, transaction);
  setCachedTodayState(action === "CLOCK_IN" ? { clockedIn: true } : { clockedOut: true });

  return transaction;
}

/**
 * Uploads whatever is currently queued. Safe to call speculatively (e.g.
 * on an `online` browser event, or on a timer) - a queue of zero is a
 * cheap no-op, and a partial failure mid-batch leaves the un-synced
 * remainder queued for the next attempt rather than losing anything
 * (spec §63/§64).
 */
export async function syncPendingOfflineAttendance() {
  const context = currentContext();
  const pending = await getPendingTransactions(context);

  if (pending.length === 0) {
    return { attempted: 0, results: [] };
  }

  const { data: results } = await syncOfflineAttendance(pending);
  await applySyncResults(context, results);

  return { attempted: pending.length, results };
}

export async function getPendingOfflineCount() {
  const context = currentContext();
  return countPending(context);
}

// ─────────────────────────────────────────────────────────────────────────
// "What's my next action today?" cache.
//
// Deciding whether the next tap should be CLOCK_IN or CLOCK_OUT normally
// means asking the server (getMyAttendance()) - not possible while
// offline. This is a small, deliberately non-sensitive local cache
// (today's clockedIn/clockedOut booleans only, nothing else) kept in
// localStorage rather than the IndexedDB journal, updated from two
// places: every successful ONLINE getMyAttendance()/scan response, and
// every offline transaction appended locally. It resets naturally every
// day since the key includes today's date.
//
// This is a deliberate scoping simplification, not a hidden one: if the
// employee uses a second device to clock in online and then goes offline
// on THIS device without ever loading this page while online today, this
// cache won't know about it, and the offline action picker may default
// to the wrong action. The server is always the final word regardless -
// see OfflineAttendanceSyncService - so the worst case is a rejected/
// flagged sync, not a silently wrong attendance record.
// ─────────────────────────────────────────────────────────────────────────

const TODAY_STATE_KEY_PREFIX = "ehral-attendance-today-state:";

function todayStateKey(context) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `${TODAY_STATE_KEY_PREFIX}${context.businessId}:${context.membershipId}:${dateStr}`;
}

export function getCachedTodayState() {
  try {
    const context = currentContext();
    const raw = window.localStorage.getItem(todayStateKey(context));
    return raw ? JSON.parse(raw) : { clockedIn: false, clockedOut: false };
  } catch {
    return { clockedIn: false, clockedOut: false };
  }
}

export function setCachedTodayState(patch) {
  try {
    const context = currentContext();
    const current = getCachedTodayState();
    window.localStorage.setItem(todayStateKey(context), JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best-effort - worst case the offline action picker shows the wrong
    // default and the employee can't do much about it offline anyway.
  }
}

/** "CLOCK_IN", "CLOCK_OUT", or null if today already looks complete. */
export function nextOfflineAction() {
  const state = getCachedTodayState();
  if (!state.clockedIn) return "CLOCK_IN";
  if (!state.clockedOut) return "CLOCK_OUT";
  return null;
}
