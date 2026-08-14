import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMessages,
  sendMessage as apiSendMessage,
  editMessage as apiEditMessage,
  deleteMessage as apiDeleteMessage,
  setReaction as apiSetReaction,
  removeReaction as apiRemoveReaction,
  markRead as apiMarkRead,
} from "../api/messagingApi";
import { subscribeToConversation } from "../services/messagingSocket";
import {
  getCachedMessagesSync,
  hydrateMessagesFromDisk,
  setCachedMessages,
} from "../services/messagingCache";

const PAGE_SIZE = 30;

// Merges a cached copy of a thread with a fresh page from the server:
// the server's copy of any message id always wins (it's the source of
// truth for edits/deletes/reactions/status), but older cached messages
// the fresh page doesn't reach back far enough to include are kept, so
// reopening a chat doesn't visually "forget" history it already had on
// screen a moment ago while the reconciliation call is in flight.
function mergeMessages(cached, fresh) {
  const byId = new Map();
  for (const m of cached) if (typeof m.id === "number") byId.set(m.id, m);
  for (const m of fresh) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// Drives one open conversation: history + cursor-based pagination (section
// 23) loaded once over REST, then kept live purely by WebSocket events —
// no re-fetch of the whole thread on every new message (section 28's
// "don't reload the entire chat when one message arrives").
//
// Renders from messagingCache's last-known copy of THIS conversation
// immediately on mount/switch — no spinner for a chat that's been opened
// before, even across a page reload — and reconciles with the server in
// the background (see mergeMessages above and messagingCache.js's doc).
export default function useConversationMessages(conversationId, viewerIdentityIdRaw) {
  // Defensive second line of defence against the string-vs-number
  // identityId mismatch documented in MessagingHub.jsx — every comparison
  // below assumes a number.
  const viewerIdentityId = viewerIdentityIdRaw != null ? Number(viewerIdentityIdRaw) : null;
  const initialCached = conversationId ? getCachedMessagesSync(conversationId) : null;
  const [messages, setMessages] = useState(initialCached || []);
  const [loading, setLoading] = useState(!initialCached);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const typingTimers = useRef(new Map());

  const upsert = useCallback((dto) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === dto.id);
      if (idx === -1) return [...prev, dto];
      const next = prev.slice();
      next[idx] = dto;
      return next;
    });
  }, []);

  // Every change to `messages` gets mirrored into the cache (memory
  // immediately, disk debounced) so the NEXT time this conversation opens
  // — even after a full page reload — it's already there.
  useEffect(() => {
    if (!conversationId) return;
    const confirmed = messages.filter((m) => typeof m.id === "number");
    if (confirmed.length > 0) setCachedMessages(conversationId, confirmed);
  }, [conversationId, messages]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;

    const cachedNow = getCachedMessagesSync(conversationId);
    if (cachedNow) {
      setMessages(cachedNow);
      setHasMore(true);
      setLoading(false);
    } else {
      setMessages([]);
      setHasMore(true);
      setLoading(true);
    }

    const reconcile = (baseline) => {
      getMessages(conversationId, { limit: PAGE_SIZE }).then(({ data }) => {
        if (cancelled) return;
        setMessages((prev) => mergeMessages(baseline ?? prev, data));
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      });
    };

    if (cachedNow) {
      reconcile(cachedNow);
    } else {
      // Nothing in memory (first open since a page refresh) — check disk
      // before falling back to a bare network fetch, so a hard reload
      // still paints instantly whenever IndexedDB has this thread cached.
      hydrateMessagesFromDisk(conversationId).then((disk) => {
        if (cancelled) return;
        if (disk) {
          setMessages(disk);
          setLoading(false);
        }
        reconcile(disk);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMore || messagesRef.current.length === 0) return;
    setLoadingOlder(true);
    try {
      const beforeId = messagesRef.current[0].id;
      const { data } = await getMessages(conversationId, { beforeId, limit: PAGE_SIZE });
      setMessages((prev) => [...data, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, hasMore]);

  // Mark-as-read whenever the thread is open and there's something unread
  // to clear — covers both "opened the conversation" and "a new message
  // arrived while it was already open" (section 13).
  useEffect(() => {
    if (!conversationId) return;
    apiMarkRead(conversationId).catch(() => {});
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const unsubscribe = subscribeToConversation(conversationId, (event) => {
      if (!event) return;
      switch (event.type) {
        case "MESSAGE_CREATED":
        case "MESSAGE_UPDATED":
        case "MESSAGE_DELETED":
        case "MESSAGE_REACTION_UPDATED":
          upsert(event.payload);
          if (event.type === "MESSAGE_CREATED") apiMarkRead(conversationId).catch(() => {});
          break;
        case "MESSAGE_DELIVERED": {
          const { messageId } = event.payload;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId && m.senderIdentityId === viewerIdentityId && m.status === "SENT"
                ? { ...m, status: "DELIVERED" }
                : m
            )
          );
          break;
        }
        case "MESSAGE_READ": {
          const { readerIdentityId, lastReadMessageId } = event.payload;
          if (readerIdentityId === viewerIdentityId) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.senderIdentityId === viewerIdentityId && m.id <= lastReadMessageId
                ? { ...m, status: "READ" }
                : m
            )
          );
          break;
        }
        case "USER_TYPING": {
          const { identityId, name } = event.payload;
          if (identityId === viewerIdentityId) break;
          setTypingUsers((prev) => (prev.some((u) => u.identityId === identityId) ? prev : [...prev, { identityId, name }]));
          clearTimeout(typingTimers.current.get(identityId));
          typingTimers.current.set(
            identityId,
            setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.identityId !== identityId));
            }, 6000) // safety net if a STOP frame is ever lost mid-flight
          );
          break;
        }
        case "USER_STOPPED_TYPING": {
          const { identityId } = event.payload;
          clearTimeout(typingTimers.current.get(identityId));
          setTypingUsers((prev) => prev.filter((u) => u.identityId !== identityId));
          break;
        }
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      setTypingUsers([]);
    };
  }, [conversationId, upsert, viewerIdentityId]);

  const send = useCallback(
    async (payload) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        id: tempId,
        conversationId,
        senderIdentityId: viewerIdentityId,
        senderName: "You",
        messageType: payload.messageType,
        body: payload.body,
        metadata: payload.metadata,
        replyTo: payload.replyToPreview || null,
        reactions: [],
        createdAt: new Date().toISOString(),
        edited: false,
        deleted: false,
        status: "SENDING",
        mentions: payload.mentions || [],
        __optimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const { data } = await apiSendMessage(conversationId, {
          messageType: payload.messageType,
          body: payload.body,
          metadata: payload.metadata,
          replyToMessageId: payload.replyToMessageId,
          mentions: payload.mentions,
        });
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          return withoutTemp.some((m) => m.id === data.id) ? withoutTemp : [...withoutTemp, data];
        });
        return data;
      } catch (err) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m)));
        throw err;
      }
    },
    [conversationId, viewerIdentityId]
  );

  const retry = useCallback(
    (failedMessage) => {
      setMessages((prev) => prev.filter((m) => m.id !== failedMessage.id));
      return send({
        messageType: failedMessage.messageType,
        body: failedMessage.body,
        metadata: failedMessage.metadata,
        replyToMessageId: failedMessage.replyTo?.messageId,
        mentions: failedMessage.mentions,
      });
    },
    [send]
  );

  const edit = useCallback(async (messageId, body) => {
    const { data } = await apiEditMessage(messageId, body);
    upsert(data);
    return data;
  }, [upsert]);

  const remove = useCallback(
    async (messageId, forEveryone) => {
      await apiDeleteMessage(messageId, forEveryone);
      if (!forEveryone) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      // for-everyone: the tombstoned DTO arrives via MESSAGE_DELETED over
      // the socket, so no local mutation is needed here.
    },
    []
  );

  const react = useCallback(async (messageId, reaction) => {
    const { data } = await apiSetReaction(messageId, reaction);
    upsert(data);
  }, [upsert]);

  const unreact = useCallback(async (messageId) => {
    const { data } = await apiRemoveReaction(messageId);
    upsert(data);
  }, [upsert]);

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    loadOlder,
    typingUsers,
    send,
    retry,
    edit,
    remove,
    react,
    unreact,
  };
}