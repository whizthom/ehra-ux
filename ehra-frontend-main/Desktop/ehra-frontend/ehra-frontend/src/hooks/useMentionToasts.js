import { useCallback, useEffect, useState } from "react";
import { subscribeToUserQueue } from "../services/messagingSocket";
import { playNotificationSound } from "../services/notificationSound";

const AUTO_DISMISS_MS = 8000;

// Surfaces "@you were mentioned" (see MsgWsEvent.MESSAGE_MENTION on the
// backend, and sendMessage's mention-validation step) as toasts — and,
// critically, mounted at the DASHBOARD level (not inside MessagingHub),
// so a mention reaches someone regardless of which tab they currently
// have open, not just while they already happen to be looking at
// Messages. Before this existed, mentions were persisted (MsgMention
// rows) but nothing ever told the mentioned person about it at all.
export default function useMentionToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToUserQueue((event) => {
      if (!event || event.type !== "MESSAGE_MENTION") return;
      // Uses the SAME "messages" category chime as an ordinary new
      // message (playNotificationSound with kind: "message", not a
      // separate melody) — a mention is a kind of message notification,
      // and it was previously the one type of message alert with no
      // sound at all, silent while an ordinary message chimed.
      //
      // id MUST match the format useNewMessageToasts.js uses
      // (`message:${messageId}`) — sending a message that also mentions
      // someone fires BOTH NEW_MESSAGE_NOTIFICATION and MESSAGE_MENTION
      // to that same person for the identical message. Using a
      // differently-shaped id here would defeat playNotificationSound's
      // own 15s duplicate-event dedupe and produce two overlapping
      // sounds for one message instead of the intended one.
      playNotificationSound({ kind: "message", id: `message:${event.payload.messageId}` });
      const toast = { id: `${event.payload.messageId}-${Date.now()}`, ...event.payload };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
    return unsubscribe;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, dismiss };
}