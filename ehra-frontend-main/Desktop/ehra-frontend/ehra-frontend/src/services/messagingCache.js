// Client-side cache that makes the messaging UI feel instant, the way
// WhatsApp does: the chat list and an open conversation render from the
// last-known local copy the INSTANT they're asked for, while the backend
// (still the real source of truth — section 1 of the spec never changes)
// is asked in the background to reconcile it. Two layers:
//
//   1. An in-memory Map, alive for as long as the tab is open. Covers
//      "switch to another chat and back" — zero network calls, zero
//      loading spinner, the exact thing that felt slow before.
//   2. IndexedDB, persisted across page reloads / browser restarts.
//      Covers "closed the tab, opened Ehral again later" the way
//      WhatsApp's own local database does, so even a hard refresh shows
//      the last-seen state immediately instead of a blank list.
//
// Neither layer is ever trusted as final. Every hydrate-from-cache is
// followed by a real REST call (see useConversations.js /
// useConversationMessages.js) that reconciles and overwrites it — this is
// a paint-time optimization, not a second source of truth.

const DB_NAME = "ehra-messaging-cache";
const DB_VERSION = 1;
const STORE_CONVERSATIONS = "conversations";
const STORE_MESSAGES = "messages";

// Deep scrollback always goes to the network (cursor pagination, section
// 23) — the cache only needs to make the most recent stretch of a
// conversation reappear instantly, so it's deliberately capped rather
// than trying to mirror the whole history to disk.
const MAX_CACHED_MESSAGES_PER_CONVERSATION = 60;

let dbPromise = null;

function openDb() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) db.createObjectStore(STORE_CONVERSATIONS);
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) db.createObjectStore(STORE_MESSAGES);
    };
    req.onsuccess = () => resolve(req.result);
    // A private-browsing tab or a corrupted DB shouldn't break messaging —
    // just degrade to the in-memory-only layer.
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function idbGet(storeName, key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(storeName, key, value) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ── In-memory layer ──────────────────────────────────────────────────
const memoryConversations = { value: null };
const memoryMessages = new Map(); // conversationId -> array

export function getCachedConversationsSync() {
  return memoryConversations.value;
}

export function getCachedMessagesSync(conversationId) {
  return memoryMessages.get(conversationId) || null;
}

// Debounced disk writes — a conversation firing typing/delivery/read
// events constantly shouldn't mean an IndexedDB write on every single
// one; batch them.
const pendingWrites = new Map();
function scheduleWrite(key, fn) {
  clearTimeout(pendingWrites.get(key));
  pendingWrites.set(key, setTimeout(fn, 400));
}

export function setCachedConversations(list) {
  memoryConversations.value = list;
  scheduleWrite("conversations", () => idbSet(STORE_CONVERSATIONS, "list", list));
}

export function setCachedMessages(conversationId, messages) {
  const capped =
    messages.length > MAX_CACHED_MESSAGES_PER_CONVERSATION
      ? messages.slice(messages.length - MAX_CACHED_MESSAGES_PER_CONVERSATION)
      : messages;
  memoryMessages.set(conversationId, capped);
  scheduleWrite(`messages:${conversationId}`, () => idbSet(STORE_MESSAGES, conversationId, capped));
}

// Called once, lazily, the first time a hook needs data the in-memory
// layer doesn't have yet (i.e. right after a page reload). Cheap no-op on
// every call after that, since the result gets folded into the memory
// layer above.
export async function hydrateConversationsFromDisk() {
  if (memoryConversations.value) return memoryConversations.value;
  const stored = await idbGet(STORE_CONVERSATIONS, "list");
  if (stored) memoryConversations.value = stored;
  return stored;
}

export async function hydrateMessagesFromDisk(conversationId) {
  if (memoryMessages.has(conversationId)) return memoryMessages.get(conversationId);
  const stored = await idbGet(STORE_MESSAGES, conversationId);
  if (stored) memoryMessages.set(conversationId, stored);
  return stored;
}

// Call on logout. Nothing about one person's inbox should linger in
// IndexedDB (or memory) once their session ends — the next person to use
// this browser/device must not see it.
export async function clearMessagingCache() {
  memoryConversations.value = null;
  memoryMessages.clear();
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], "readwrite");
    tx.objectStore(STORE_CONVERSATIONS).clear();
    tx.objectStore(STORE_MESSAGES).clear();
  } catch {
    // best-effort
  }
}