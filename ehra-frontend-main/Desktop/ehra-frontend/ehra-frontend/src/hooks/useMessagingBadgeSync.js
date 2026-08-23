import { useEffect } from "react";
import { subscribeToUserQueue } from "../services/messagingSocket";

// Small helper for pages that keep their own `messagesUnread` state
// (Dashboard.jsx / EmployeeDashboard.jsx already did, for the old chat's
// badge) rather than using useMessagingBadge's self-contained state.
// Just re-invokes whatever refresh callback they already have whenever a
// WebSocket event implies the count may have changed.
//
// Sound/toast notification for an incoming message does NOT live here
// anymore — it moved to useNewMessageToasts.js, driven by the backend's
// dedicated NEW_MESSAGE_NOTIFICATION event (sender name, snippet,
// mute-aware) rather than piggybacking on CONVERSATION_UPDATED here,
// which also fires for pin/mute/archive changes and carried no sender
// info to show in a toast. Keeping both would have meant two sounds for
// the same message.
export default function useMessagingBadgeSync(onPossibleChange) {
  useEffect(() => {
    const unsubscribe = subscribeToUserQueue((event) => {
      if (!event) return;
      if (
        event.type === "CONVERSATION_UPDATED" ||
        event.type === "CONVERSATION_CREATED" ||
        event.type === "UNREAD_COUNT_UPDATED"
      ) {
        onPossibleChange();
      }
    });
    return unsubscribe;
  }, [onPossibleChange]);
}