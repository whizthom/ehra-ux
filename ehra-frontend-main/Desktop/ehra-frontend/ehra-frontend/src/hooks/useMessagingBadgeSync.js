import { useEffect } from "react";
import { subscribeToUserQueue } from "../services/messagingSocket";

// Small helper for pages that keep their own `messagesUnread` state
// (Dashboard.jsx / EmployeeDashboard.jsx already did, for the old chat's
// badge) rather than using useMessagingBadge's self-contained state.
// Just re-invokes whatever refresh callback they already have whenever a
// WebSocket event implies the count may have changed.
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