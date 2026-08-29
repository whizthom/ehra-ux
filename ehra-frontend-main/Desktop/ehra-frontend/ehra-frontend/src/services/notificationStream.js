import { getAccessToken, getRefreshToken, refreshAccessToken, API_BASE_URL } from "../api/authApi";

// The single shared SSE connection to /api/messages/stream — same pattern
// as messagingSocket.js's shared WebSocket. Previously, every component
// that called useMessageStream() opened its OWN separate EventSource
// (Dashboard.jsx, EmployeeDashboard.jsx, MessagesTab.jsx,
// CoverRequestsTab.jsx, LeavesTab.jsx, EmployeeLeaveTab.jsx each did this
// independently), meaning a single user viewing, say, the Leave tab could
// have three or four redundant connections open to the same backend
// stream at once — tolerated (the backend can serve many emitters per
// user fine) but wasteful, and exactly what useMessageStream.js's own
// comment already flagged as "until the stream is consolidated." This is
// that consolidation: one real connection, however many subscribers.
//
// All reconnection/backoff/token-refresh logic here is preserved
// EXACTLY as it was in the old per-hook implementation — the actual
// connection-reliability behavior doesn't change, only how many physical
// connections exist.

const EVENT_TYPES = ["new_message", "read_update", "new_notification", "leave_update", "new_chat_message", "chat_read"];

let es = null;
let reconnectTimer = null;
let retryDelay = 3000; // doubles on each consecutive failure, capped at 30s
let active = false; // true once at least one subscriber exists
const listenersByType = new Map(EVENT_TYPES.map((t) => [t, new Set()]));
let subscriberCount = 0;

function dispatch(type, payload) {
  for (const handler of listenersByType.get(type) ?? []) {
    try {
      handler(payload);
    } catch {
      // one bad subscriber shouldn't take down delivery to the others
    }
  }
}

function wireHandlers(source) {
  source.addEventListener("connected", () => {
    console.debug("[SSE] Message stream connected");
    // A successful connection means the token we used was good — reset
    // backoff so a future drop retries quickly again instead of
    // inheriting a long delay from a previous outage.
    retryDelay = 3000;
  });

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (e) => {
      try {
        dispatch(type, JSON.parse(e.data));
      } catch {
        // ignore a malformed event rather than let it break the stream
      }
    });
  }
}

// Opens a fresh EventSource using whatever the CURRENT access token is at
// the moment this runs — never a value captured once and reused. Native
// EventSource has automatic reconnection built in, but every automatic
// retry reuses the exact URL (and therefore the exact token) it was
// first constructed with. A short-lived access token (~15 min — see
// authApi.js) that was still valid when the connection opened can easily
// have expired by the time a dropped connection reconnects — a Render
// free-tier cold start (30-60s) makes this common, but it can happen
// from any connection drop given how short-lived the token is. Managing
// reconnection ourselves means every attempt gets a token that's
// actually current.
function connect() {
  if (!active) return;
  const token = getAccessToken();
  if (!token) return; // logged out while we were reconnecting

  // EventSource doesn't support custom headers, so the token travels as
  // a query param — the backend's JwtFilter accepts this only for this
  // specific route.
  const url = `${API_BASE_URL}/messages/stream?token=${encodeURIComponent(token)}`;
  es = new EventSource(url);
  wireHandlers(es);

  es.onerror = () => {
    console.debug("[SSE] Message stream error/reconnecting...");
    es.close();
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (!active) return;
  // No refresh token at all means the session is genuinely over (logged
  // out, or the axios interceptor already cleared it after a real 401) —
  // nothing to recover here.
  if (!getRefreshToken()) return;

  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    if (!active) return;
    try {
      // Proactively refresh rather than just retrying with whatever is
      // in storage — refreshAccessToken() is shared with the axios
      // interceptor and dedupes concurrent calls, so this doesn't race a
      // refresh already happening elsewhere.
      await refreshAccessToken();
    } catch {
      // Refresh failed — could be a still-waking backend (worth
      // retrying) or a genuinely dead refresh token. Either way, fall
      // through and try connecting with whatever token is now stored.
    }
    retryDelay = Math.min(retryDelay * 2, 30000);
    connect();
  }, retryDelay);
}

// Registers `handler` for `eventType` and returns an unsubscribe
// function. The underlying connection opens lazily on the first
// subscriber (across the WHOLE app, not per-component) and closes once
// the last one unsubscribes — so a page that never needs any of this
// (e.g. someone who's logged out) never opens a connection at all, while
// five components all wanting `new_notification` share the exact same
// one.
export function subscribe(eventType, handler) {
  const set = listenersByType.get(eventType);
  if (!set) {
    console.warn(`[SSE] Unknown event type: ${eventType}`);
    return () => {};
  }
  set.add(handler);
  subscriberCount += 1;
  if (!active) {
    active = true;
    connect();
  }

  return () => {
    set.delete(handler);
    subscriberCount -= 1;
    if (subscriberCount <= 0) {
      active = false;
      clearTimeout(reconnectTimer);
      es?.close();
      es = null;
    }
  };
}