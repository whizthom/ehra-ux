import { useCallback, useEffect, useState } from "react";
import { subscribeToUserQueue } from "../services/messagingSocket";
import { playMessageSound } from "../services/notificationSound";

const AUTO_DISMISS_MS = 6000;

// Surfaces "you have a new message" (NEW_MESSAGE_NOTIFICATION - see
// MsgMessagingServiceImpl#sendMessage) as a toast + the app's existing
// notification chime (services/notificationSound.js, which already has a
// dedicated "messages" category - this reuses it rather than building a
// second sound system). Mounted at the Dashboard level, same as
// useMentionToasts, specifically so a message notifies someone no matter
// which tab is open, not just while they're already looking at Messages.
//
// `activeConversationId` lets the caller suppress the toast/sound for
// whichever conversation is CURRENTLY open and visibly on screen - no
// point popping a notification for a message the person can already see
// arrive live in the open chat window.
//
// `channel` scopes which inbox's messages toast here: "STAFF" (the
// original workplace inbox, the default) or "CUSTOMER" (Business <->
// Customer). A workplace dashboard must not chime for a customer's message
// it can't open, nor a customer/business-type workspace for a workplace one.
export default function useNewMessageToasts(activeConversationId, channel = "STAFF") {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToUserQueue((event) => {
      if (!event || event.type !== "NEW_MESSAGE_NOTIFICATION") return;
      const payload = event.payload;
      if ((payload.channel || "STAFF") !== channel) return;
      if (activeConversationId && payload.conversationId === activeConversationId) return;

      playMessageSound({ id: `message:${payload.messageId}`, conversationId: payload.conversationId });

      const toast = { id: `${payload.messageId}-${Date.now()}`, ...payload };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
    return unsubscribe;
  }, [activeConversationId, channel]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, dismiss };
}