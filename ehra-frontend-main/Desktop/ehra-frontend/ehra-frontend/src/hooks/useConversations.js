import { useCallback, useEffect, useRef, useState } from "react";
import { listConversations } from "../api/messagingApi";
import { subscribeToUserQueue } from "../services/messagingSocket";

// The chat list's data source (section 4 of the spec): loads via REST,
// then stays live entirely off the personal WebSocket queue — no polling,
// no manual refresh button. CONVERSATION_CREATED/CONVERSATION_UPDATED
// events patch the list in place and re-sort it (pinned first, then most
// recently active), which is also how the unread badge, last-message
// preview, and online dot all update instantly when a message arrives
// while the chat list (not the thread itself) is what's on screen.
export default function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const sortAndSet = useCallback((list) => {
    const sorted = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
    });
    setConversations(sorted);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listConversations();
      sortAndSet(data);
    } finally {
      setLoading(false);
    }
  }, [sortAndSet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeToUserQueue((event) => {
      if (!event) return;
      if (event.type === "CONVERSATION_UPDATED" || event.type === "CONVERSATION_CREATED") {
        const incoming = event.payload;
        const existingIndex = conversationsRef.current.findIndex((c) => c.id === incoming.id);
        let next;
        if (existingIndex === -1) {
          next = [incoming, ...conversationsRef.current];
        } else {
          next = conversationsRef.current.map((c) => (c.id === incoming.id ? incoming : c));
        }
        sortAndSet(next);
      } else if (event.type === "REMOVED_FROM_CONVERSATION") {
        sortAndSet(conversationsRef.current.filter((c) => c.id !== event.payload));
      }
    });
    return unsubscribe;
  }, [sortAndSet]);

  // Presence pushed to the personal queue too (see
  // MsgWebSocketEventListener) so a DIRECT conversation's online dot
  // updates even while the chat list — not that thread — is open.
  useEffect(() => {
    const unsubscribe = subscribeToUserQueue((event) => {
      if (!event || (event.type !== "USER_ONLINE" && event.type !== "USER_OFFLINE")) return;
      const { identityId, online } = event.payload;
      sortAndSet(
        conversationsRef.current.map((c) => {
          if (c.type !== "DIRECT") return c;
          const isThatPerson = c.participants?.[0]?.identityId === identityId;
          if (!isThatPerson) return c;
          return {
            ...c,
            online,
            participants: c.participants.map((p) =>
              p.identityId === identityId ? { ...p, online } : p
            ),
          };
        })
      );
    });
    return unsubscribe;
  }, [sortAndSet]);

  return { conversations, loading, refresh };
}