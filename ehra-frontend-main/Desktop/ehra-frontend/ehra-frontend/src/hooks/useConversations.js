import { useCallback, useEffect, useRef, useState } from "react";
import { listConversations } from "../api/messagingApi";
import { subscribeToUserQueue } from "../services/messagingSocket";
import {
  getCachedConversationsSync,
  hydrateConversationsFromDisk,
  setCachedConversations,
} from "../services/messagingCache";

// The chat list's data source (section 4 of the spec): loads via REST,
// then stays live entirely off the personal WebSocket queue — no polling,
// no manual refresh button. CONVERSATION_CREATED/CONVERSATION_UPDATED
// events patch the list in place and re-sort it (pinned first, then most
// recently active), which is also how the unread badge, last-message
// preview, and online dot all update instantly when a message arrives
// while the chat list (not the thread itself) is what's on screen.
//
// Renders from messagingCache's last-known copy the instant this mounts
// — no spinner if we've shown this list before, even across a page
// reload — and only THEN asks the server to reconcile it (see
// messagingCache.js's doc for why that order is what makes this feel
// instant instead of "instant but only after the first time").
export default function useConversations() {
  const cachedInitial = getCachedConversationsSync();
  const [conversations, setConversations] = useState(cachedInitial || []);
  const [loading, setLoading] = useState(!cachedInitial);
  // Surfaced so the UI can tell "genuinely zero conversations" apart from
  // "the request failed and we just don't know yet" — before this, any
  // error here (401/403 from a stale token, a 500, a network blip) was
  // swallowed silently and looked identical to an empty list.
  const [error, setError] = useState(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const sortAndSet = useCallback((list) => {
    const sorted = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
    });
    setConversations(sorted);
    setCachedConversations(sorted);
  }, []);

  const refresh = useCallback(async () => {
    // Only show the spinner if there's truly nothing on screen yet — a
    // background reconciliation shouldn't ever cause a visible flicker.
    if (conversationsRef.current.length === 0) setLoading(true);
    try {
      const { data } = await listConversations();
      setError(null);
      sortAndSet(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[messaging] Failed to load conversations:", err?.response?.status, err?.response?.data || err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sortAndSet]);

  useEffect(() => {
    if (!cachedInitial) {
      // Nothing in memory (first load since a page refresh) — try disk
      // before falling back to a bare network fetch, so a hard reload
      // still paints instantly whenever IndexedDB has something.
      hydrateConversationsFromDisk().then((disk) => {
        if (disk) {
          setConversations(disk);
          setLoading(false);
        }
        refresh();
      });
    } else {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return { conversations, loading, error, refresh };
}