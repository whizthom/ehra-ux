import { useEffect, useRef } from "react";
import { getAccessToken, getRefreshToken, refreshAccessToken, API_BASE_URL } from "../api/authApi";

/**
 * Opens an SSE connection to /api/messages/stream and calls the
 * provided callbacks when events arrive. One connection per mounted
 * component is fine — the backend keeps a list of emitters per user
 * email, so multiple tabs/components for the same user all get pushed to.
 *
 * @param {object} handlers
 *   - onNewMessage(payload)      — a new announcement/message arrived
 *   - onReadUpdate(payload)      — a read-receipt update arrived (admin)
 *   - onNewNotification(payload) — a new Notification row was created for this user
 *   - onLeaveUpdate(payload)     — a LeaveDTO changed and this user is involved
 *     in it (requester, cover person, HOD, or employer). Fires alongside
 *     onNewNotification, not instead of it — useful for patching a leave
 *     already on screen without waiting on a re-fetch.
 *   - onNewChatMessage(payload)  — a new 1:1 chat ChatMessageDTO arrived
 *   - onChatRead(payload)        — the other side of an open chat thread just read it ({conversationId})
 * @param {boolean} enabled       — set false to skip opening the connection
 */
export default function useMessageStream(
  { onNewMessage, onReadUpdate, onNewNotification, onLeaveUpdate, onNewChatMessage, onChatRead } = {},
  enabled = true
) {
  // Handlers are read via a ref (kept current every render below) rather
  // than being effect dependencies — this way a reconnect only happens
  // because the connection actually dropped, never just because a
  // parent re-rendered and passed a new inline callback.
  const handlersRef = useRef({});
  useEffect(() => {
    handlersRef.current = { onNewMessage, onReadUpdate, onNewNotification, onLeaveUpdate, onNewChatMessage, onChatRead };
  });

  useEffect(() => {
    if (!enabled) return;
    if (!getAccessToken()) return;

    let es = null;
    let reconnectTimer = null;
    let retryDelay = 3000; // doubles on each consecutive failure, capped below
    let stopped = false;

    const wireHandlers = (source) => {
      const h = handlersRef.current;

      source.addEventListener("connected", () => {
        console.debug("[SSE] Message stream connected");
        // A successful connection means the token we used was good —
        // reset backoff so a future drop retries quickly again instead
        // of inheriting a long delay from a previous outage.
        retryDelay = 3000;
      });

      if (h.onNewMessage) {
        source.addEventListener("new_message", (e) => {
          try { handlersRef.current.onNewMessage(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
      if (h.onReadUpdate) {
        source.addEventListener("read_update", (e) => {
          try { handlersRef.current.onReadUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
      if (h.onNewNotification) {
        source.addEventListener("new_notification", (e) => {
          try { handlersRef.current.onNewNotification(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
      if (h.onLeaveUpdate) {
        source.addEventListener("leave_update", (e) => {
          try { handlersRef.current.onLeaveUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
      if (h.onNewChatMessage) {
        source.addEventListener("new_chat_message", (e) => {
          try { handlersRef.current.onNewChatMessage(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
      if (h.onChatRead) {
        source.addEventListener("chat_read", (e) => {
          try { handlersRef.current.onChatRead(JSON.parse(e.data)); } catch { /* ignore */ }
        });
      }
    };

    // Opens a fresh EventSource using whatever the CURRENT access token
    // is at the moment this runs — never a value captured once and
    // reused. This is the actual fix: native EventSource has automatic
    // reconnection built in, but every automatic retry reuses the exact
    // URL (and therefore the exact token) it was first constructed
    // with. A short-lived access token (~15 min — see authApi.js) that
    // was still valid when the connection opened can easily have
    // expired by the time a dropped connection reconnects — a Render
    // free-tier cold start (30-60s) makes this common, but it can
    // happen from any connection drop given how short-lived the token
    // is. Once that happens, native auto-retry just keeps getting
    // rejected with the same stale token forever, and messages/
    // notifications silently stop arriving until something else (a
    // manual refresh) opens a new connection with a current token.
    // Managing reconnection ourselves means every attempt gets a token
    // that's actually current.
    const connect = () => {
      if (stopped) return;

      const token = getAccessToken();
      if (!token) return; // logged out while we were reconnecting

      // EventSource doesn't support custom headers, so we pass the token as
      // a query param. The backend's JwtFilter accepts this only for this
      // specific route.
      const url = `${API_BASE_URL}/messages/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      wireHandlers(es);

      es.onerror = () => {
        console.debug("[SSE] Message stream error/reconnecting...");
        es.close();
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (stopped) return;

      // No refresh token at all means the session is genuinely over
      // (logged out, or the axios interceptor already cleared it after
      // a real 401) — nothing to recover here. A fresh login remounts
      // this hook and starts clean.
      if (!getRefreshToken()) return;

      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(async () => {
        if (stopped) return;
        try {
          // Proactively refresh rather than just retrying with whatever
          // is in storage — if nothing else in the app has made an API
          // call recently, storage could hold the same stale token that
          // just failed. refreshAccessToken() is shared with the axios
          // interceptor (see authApi.js) and dedupes concurrent calls,
          // so this doesn't race a refresh already happening elsewhere.
          await refreshAccessToken();
        } catch {
          // Refresh failed — could be a still-waking backend (worth
          // retrying) or a genuinely dead refresh token (getRefreshToken
          // above will catch that on the next pass once the interceptor
          // clears it). Either way, fall through and try connecting with
          // whatever token is currently stored.
        }
        retryDelay = Math.min(retryDelay * 2, 30000); // cap at 30s
        connect();
      }, retryDelay);
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled]);
}