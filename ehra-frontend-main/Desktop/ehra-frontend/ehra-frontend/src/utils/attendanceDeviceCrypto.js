const DB_NAME = "ehral-attendance-device";
const STORE_NAME = "keypairs";
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
    request.onerror = () => reject(request.error || new Error("Could not open secure device storage."));
  });
}

function keyForContext({ identityId, businessId, membershipId }) {
  return [identityId, businessId, membershipId].filter(Boolean).join(":") || "default";
}

async function getStored(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read device key."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

async function putStored(key, value) {
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
      reject(tx.error || new Error("Could not save device key."));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not save device key."));
    };
  });
}

export async function getOrCreateAttendanceKeyPair(context) {
  const storageKey = keyForContext(context);
  const existing = await getStored(storageKey);
  if (existing?.keyPair?.privateKey && existing?.keyPair?.publicKey) {
    return { ...existing, storageKey };
  }

  if (!window.crypto?.subtle) {
    throw new Error("This browser does not support secure device signing.");
  }

  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );

  const publicKeyB64 = await exportPublicKeyBase64(keyPair.publicKey);
  const record = {
    keyPair,
    publicKeyB64,
    deviceId: null,
    createdAt: new Date().toISOString(),
  };

  await putStored(storageKey, record);
  return { ...record, storageKey };
}

export async function updateAttendanceDeviceId(context, deviceId) {
  const storageKey = keyForContext(context);
  const current = await getStored(storageKey);
  if (!current) return;
  await putStored(storageKey, { ...current, deviceId });
}

export async function clearAttendanceDevice(context) {
  const db = await openDb();
  const storageKey = keyForContext(context);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(storageKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Could not clear device key."));
    };
  });
}

export async function exportPublicKeyBase64(publicKey) {
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  const bytes = new Uint8Array(spki);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

export async function signAttendanceChallenge(privateKey, challenge, membershipId, action) {
  const message = new TextEncoder().encode(`${challenge}:${membershipId}:${action}`);
  const signature = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    message,
  );

  const bytes = new Uint8Array(signature);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

export function getAttendanceDeviceContext(session) {
  return {
    identityId: session?.identityId,
    businessId: session?.businessId,
    membershipId: session?.membershipId,
  };
}
