import { useEffect, useRef } from "react";
import { subscribe } from "../services/notificationStream";
import { playNotificationSound, unlockNotificationSounds } from "../services/notificationSound";

// Same public API as before (every existing call site — Dashboard.jsx,
// EmployeeDashboard.jsx, MessagesTab.jsx, CoverRequestsTab.jsx,
// LeavesTab.jsx, EmployeeLeaveTab.jsx — needs zero changes), but the
// connection itself now lives in services/notificationStream.js as ONE
// shared EventSource instead of each of those components opening its
// own. This hook is now just "subscribe my handlers to the shared
// stream, using whichever event types I was actually given handlers
// for" — see notificationStream.js's doc for why that consolidation
// mattered.
const EVENT_HANDLER_KEYS = {
  new_message: "onNewMessage",
  read_update: "onReadUpdate",
  new_notification: "onNewNotification",
  leave_update: "onLeaveUpdate",
  new_chat_message: "onNewChatMessage",
  chat_read: "onChatRead",
};

export default function useMessageStream(
  { onNewMessage, onReadUpdate, onNewNotification, onLeaveUpdate, onNewChatMessage, onChatRead } = {},
  enabled = true
) {
  // Always-current handlers, read from inside the subscription callbacks
  // below rather than closed over directly — so an inline arrow function
  // passed fresh on every parent render never forces a
  // resubscribe/reconnect, exactly like the previous implementation.
  const handlersRef = useRef({});
  useEffect(() => {
    handlersRef.current = { onNewMessage, onReadUpdate, onNewNotification, onLeaveUpdate, onNewChatMessage, onChatRead };
  });

  // Browser audio playback needs a real user gesture before it's allowed
  // to make sound at all — this listens for the first tap/keypress
  // anywhere and unlocks it, same as before.
  useEffect(() => {
    const unlock = () => unlockNotificationSounds();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    // Only subscribes to event types THIS hook instance was actually
    // given a handler for — checked once here (at mount / whenever
    // `enabled` toggles), matching the previous implementation's own
    // behavior, not on every render.
    const unsubscribers = Object.entries(EVENT_HANDLER_KEYS)
      .filter(([, handlerKey]) => Boolean(handlersRef.current[handlerKey]))
      .map(([eventType, handlerKey]) =>
        subscribe(eventType, (payload) => {
          // Sound-on-arrival stays centralized here (not per-consumer),
          // same as the old implementation — with one real connection
          // now instead of several, there's also no possibility of the
          // same event firing this twice the way multiple parallel
          // EventSources previously could.
          if (eventType === "new_notification") {
            playNotificationSound(payload);
          } else if (eventType === "new_chat_message") {
            playNotificationSound({ ...payload, kind: "message", id: payload.id });
          }
          handlersRef.current[handlerKey]?.(payload);
        })
      );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}