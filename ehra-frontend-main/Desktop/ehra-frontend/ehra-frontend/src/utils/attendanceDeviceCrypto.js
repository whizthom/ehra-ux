const DB_NAME = "ehral-attendance-device";
const STORE_NAME = "keypairs";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(
        new Error("IndexedDB is unavailable on this device.")
      );
      return;
    }

    const request = window.indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ||
          new Error("Could not open secure device storage.")
      );
  });
}

function keyForContext({ businessId }) {
  /*
   * The cryptographic identity belongs to this browser/device within an
   * Ehral business, not to an employee account. This is intentional.
   *
   * If employee A logs out and employee B signs in on the same browser/device,
   * Ehral must be able to present the same device identity to the backend so
   * the backend can detect MULTIPLE_EMPLOYEES_SAME_DEVICE.
   *
   * The employee relationship is maintained server-side by
   * AttendanceDeviceBinding.
   *
   * Offline attendance builds on top of this same device identity, but
   * offline TRUST is additionally employee-bound — see
   * OfflineAttendanceAuthorization on the backend and
   * offlineAttendanceJournal.js on the frontend, which key by employee
   * as well as by this device.
   */
  return businessId
    ? `business:${businessId}`
    : "default";
}

async function getStored(key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const request = tx
      .objectStore(STORE_NAME)
      .get(key);

    request.onsuccess = () =>
      resolve(request.result || null);

    request.onerror = () =>
      reject(
        request.error ||
          new Error("Could not read device key.")
      );

    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function putStored(key, value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    tx.objectStore(STORE_NAME).put(
      value,
      key
    );

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();

      reject(
        tx.error ||
          new Error("Could not save device key.")
      );
    };

    tx.onabort = () => {
      db.close();

      reject(
        tx.error ||
          new Error("Could not save device key.")
      );
    };
  });
}

export async function getOrCreateAttendanceKeyPair(
  context
) {
  const storageKey = keyForContext(context);

  const existing = await getStored(
    storageKey
  );

  if (
    existing?.keyPair?.privateKey &&
    existing?.keyPair?.publicKey
  ) {
    return {
      ...existing,
      storageKey,
    };
  }

  if (!window.crypto?.subtle) {
    throw new Error(
      "This browser does not support secure device signing."
    );
  }

  const keyPair =
    await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign", "verify"]
    );

  const publicKeyB64 =
    await exportPublicKeyBase64(
      keyPair.publicKey
    );

  const record = {
    keyPair,
    publicKeyB64,
    deviceId: null,
    createdAt: new Date().toISOString(),
  };

  await putStored(
    storageKey,
    record
  );

  return {
    ...record,
    storageKey,
  };
}

export async function updateAttendanceDeviceId(
  context,
  deviceId
) {
  const storageKey = keyForContext(
    context
  );

  const current = await getStored(
    storageKey
  );

  if (!current) {
    return;
  }

  await putStored(
    storageKey,
    {
      ...current,
      deviceId,
    }
  );
}

export async function clearAttendanceDevice(
  context
) {
  const db = await openDb();

  const storageKey = keyForContext(
    context
  );

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    tx.objectStore(STORE_NAME).delete(
      storageKey
    );

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();

      reject(
        tx.error ||
          new Error("Could not clear device key.")
      );
    };
  });
}

export async function exportPublicKeyBase64(
  publicKey
) {
  const spki =
    await window.crypto.subtle.exportKey(
      "spki",
      publicKey
    );

  const bytes = new Uint8Array(
    spki
  );

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        i + chunkSize
      )
    );
  }

  return window.btoa(binary);
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        i + chunkSize
      )
    );
  }

  return window.btoa(binary);
}

export async function signAttendanceChallenge(
  privateKey,
  challenge,
  membershipId,
  action
) {
  const message =
    new TextEncoder().encode(
      `${challenge}:${membershipId}:${action}`
    );

  const signature =
    await window.crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-256",
      },
      privateKey,
      message
    );

  return bufferToBase64(signature);
}

export function getAttendanceDeviceContext(
  session
) {
  return {
    identityId:
      session?.identityId,

    businessId:
      session?.businessId,

    membershipId:
      session?.membershipId,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Offline attendance transaction signing.
//
// Offline transactions are NOT signed the same way as an online scan.
// Online signs `${challenge}:${membershipId}:${action}` where `challenge`
// is a short-lived nonce fetched from the server just before signing —
// there is no server round trip available while offline to fetch one.
//
// Instead, an offline transaction signs the FULL canonical transaction
// payload itself. Both sides must build byte-identical strings or every
// signature/hash check will fail — see
// OfflineAttendanceSyncService#canonicalPayload on the backend, which
// this function mirrors field-for-field.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Formats a Date as "yyyy-MM-ddTHH:mm:ss" using the DEVICE'S LOCAL wall
 * clock (not UTC, no milliseconds, no timezone suffix) — deliberately NOT
 * `date.toISOString()`, which is UTC and would silently shift every
 * timestamp by Nigeria's UTC+1 offset relative to what the backend's
 * BusinessClock assumes. Deliberately whole-seconds only (no
 * milliseconds): Java's LocalDateTime formatter omits the fractional part
 * entirely when nanoseconds are zero, but prints it when they're not — so
 * sending milliseconds here would only match the backend's re-formatted
 * string when they happen to be exactly 000. Dropping sub-second
 * precision entirely (irrelevant for attendance anyway) avoids that whole
 * class of cross-runtime formatting mismatch.
 */
export function toCanonicalLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Builds the exact string an offline transaction is hashed and signed
 * over. Field order, delimiter, and the literal `"null"` for an absent
 * previousHash must match OfflineAttendanceSyncService#canonicalPayload
 * exactly.
 */
export function buildOfflineCanonicalPayload({
  transactionId,
  businessId,
  membershipId,
  deviceId,
  action,
  clientCreatedAt,
  sequence,
  previousHash,
  authorizationId,
}) {
  return [
    transactionId,
    String(businessId),
    String(membershipId),
    deviceId,
    action,
    toCanonicalLocalDateTime(clientCreatedAt),
    String(sequence),
    previousHash || "null",
    authorizationId,
  ].join("|");
}

/** Lowercase hex SHA-256 digest — matches Java's HexFormat.formatHex output. */
export async function sha256HexDigest(text) {
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs the canonical offline transaction payload directly (no nonce
 * prefix — see the section comment above). Same ECDSA P-256 /
 * SHA256withECDSA primitive as the online challenge signature, so the
 * backend's single `verifySignature` helper verifies both.
 */
export async function signOfflineTransaction(privateKey, canonicalPayload) {
  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    new TextEncoder().encode(canonicalPayload)
  );

  return bufferToBase64(signature);
}