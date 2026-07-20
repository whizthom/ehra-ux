import { useEffect } from "react";
import { getAccessToken, API_BASE_URL } from "../api/authApi";

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
 * @param {boolean} enabled       — set false to skip opening the connection
 */
export default function useMessageStream(
  { onNewMessage, onReadUpdate, onNewNotification, onLeaveUpdate } = {},
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const token = getAccessToken();
    if (!token) return;

    // EventSource doesn't support custom headers, so we pass the token as
    // a query param. The backend's JwtFilter accepts this only for this
    // specific route.
    const url = `${API_BASE_URL}/messages/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener("connected", () => {
      console.debug("[SSE] Message stream connected");
    });

    if (onNewMessage) {
      es.addEventListener("new_message", (e) => {
        try { onNewMessage(JSON.parse(e.data)); } catch { /* ignore */ }
      });
    }

    if (onReadUpdate) {
      es.addEventListener("read_update", (e) => {
        try { onReadUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
      });
    }

    if (onNewNotification) {
      es.addEventListener("new_notification", (e) => {
        try { onNewNotification(JSON.parse(e.data)); } catch { /* ignore */ }
      });
    }

    if (onLeaveUpdate) {
      es.addEventListener("leave_update", (e) => {
        try { onLeaveUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
      });
    }

    es.onerror = () => {
      console.debug("[SSE] Message stream error/reconnecting...");
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}