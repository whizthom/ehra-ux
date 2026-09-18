// Durable local storage for offline attendance: the authorization grant
// issued by the backend (see OfflineAttendanceAuthorizationService) and
// the queue of signed, hash-chained transactions waiting to be uploaded.
//
// Unlike messagingCache.js (best-effort - a cache miss just means a
// spinner), a lost entry here means a lost attendance record, so this
// module follows attendanceDeviceCrypto.js's stricter convention:
// failures reject instead of silently resolving to null/empty.
//
// Keyed by business + employee membership, NOT by device - the device
// credential itself is shared across employees on a business (see
// attendanceDeviceCrypto.js), but each employee's offline authorization
// and pending queue must stay completely separate. Employee B must never
// see, extend, or accidentally sync Employee A's queued transactions
// just because they're on the same physical device.

const DB_NAME = "ehral-attendance-offline";
const STORE_NAME = "journal";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is unavailable on this device."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open offline attendance storage."));
  });
}

function journalKey({ businessId, membershipId }) {
  return `${businessId}:${membershipId}`;
}

async function getEntry(key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () =>
      reject(request.error || new Error("Could not read offline attendance journal."));

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function putEntry(key, value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Could not save offline attendance journal."));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not save offline attendance journal."));
    };
  });
}

function emptyEntry() {
  return {
    authorization: null, // { authorizationId, deviceId, expiresAt, allowedActions, issuedAt }
    transactions: [], // queued, not-yet-confirmed-synced entries, oldest first
    lastPayloadHash: null, // payloadHash of the last transaction ever appended for this device's chain
    lastSequence: 0,
  };
}

/** The full local entry for this business+employee, or a fresh empty one. */
export async function getJournal(context) {
  const stored = await getEntry(journalKey(context));
  return stored || emptyEntry();
}

/**
 * Called right after a successful ONLINE attendance action, mirroring
 * OfflineAttendanceAuthorizationService#issueOrRenew on the backend.
 * Overwrites any previous authorization for this business+employee -
 * there is only ever one live grant to track locally.
 */
export async function saveAuthorization(context, authorization) {
  const entry = await getJournal(context);
  await putEntry(journalKey(context), { ...entry, authorization });
}

/**
 * "Can I clock offline right now?" - same question
 * OfflineAttendanceAuthorizationService#findLiveAuthorization answers
 * server-side, checked here purely for immediate UI state (the server
 * re-validates everything again at sync time regardless - spec §42).
 */
export async function getLiveAuthorization(context, deviceId) {
  const entry = await getJournal(context);
  const auth = entry.authorization;

  if (!auth || auth.deviceId !== deviceId) return null;
  if (new Date(auth.expiresAt).getTime() <= Date.now()) return null;

  return auth;
}

/**
 * The (sequence, previousHash) pair the NEXT transaction must use -
 * accounts for transactions already queued locally but not yet
 * confirmed-synced, not just what's been uploaded, so two offline
 * actions taken back-to-back before any connectivity returns still chain
 * correctly.
 */
export async function getNextChainLink(context) {
  const entry = await getJournal(context);
  const last = entry.transactions[entry.transactions.length - 1];

  return {
    sequence: (last ? last.sequence : entry.lastSequence) + 1,
    previousHash: last ? last.payloadHash : entry.lastPayloadHash,
  };
}

/** Appends a fully-built, signed transaction to the local queue. */
export async function appendTransaction(context, transaction) {
  const entry = await getJournal(context);
  await putEntry(journalKey(context), {
    ...entry,
    transactions: [...entry.transactions, transaction],
  });
}

export async function getPendingTransactions(context) {
  const entry = await getJournal(context);
  return entry.transactions;
}

export async function countPending(context) {
  const entry = await getJournal(context);
  return entry.transactions.length;
}

/**
 * Reconciles the local queue against the server's sync results (spec
 * §64): a SYNCED or REJECTED transaction is removed from the pending
 * queue for good - REJECTED is a definitive server verdict, not
 * something to silently retry forever. A FLAGGED transaction is also
 * removed from the queue (the server has a durable record of it now,
 * even though a human needs to look at it) but is NOT treated as if it
 * failed to sync, so it isn't retried. Anything the server didn't return
 * a result for (network failure mid-upload) stays queued for the next
 * sync attempt.
 * <p>
 * `lastPayloadHash`/`lastSequence` only advance past transactions that
 * actually got a definitive server outcome - a transaction that never
 * made it to the server keeps the chain exactly where it was, so a retry
 * continues the chain correctly instead of skipping ahead.
 */
export async function applySyncResults(context, results) {
  const entry = await getJournal(context);
  const resultByTransactionId = new Map(results.map((r) => [r.transactionId, r]));

  const stillPending = [];
  let lastPayloadHash = entry.lastPayloadHash;
  let lastSequence = entry.lastSequence;

  for (const transaction of entry.transactions) {
    const result = resultByTransactionId.get(transaction.transactionId);

    if (!result || result.syncStatus === "SYNCING") {
      stillPending.push(transaction);
      continue;
    }

    // SYNCED, FLAGGED, or REJECTED - all definitive. Advance the chain
    // pointer regardless of which one, since the server has already
    // validated (or rejected) this exact sequence/hash - retrying it
    // under a new sequence number would only break the chain further.
    lastPayloadHash = transaction.payloadHash;
    lastSequence = transaction.sequence;
  }

  await putEntry(journalKey(context), {
    ...entry,
    transactions: stillPending,
    lastPayloadHash,
    lastSequence,
  });
}

/** Call on logout - nothing about one employee's offline queue should be reachable by whoever logs in next on this device. */
export async function clearJournal(context) {
  await putEntry(journalKey(context), emptyEntry());
}
