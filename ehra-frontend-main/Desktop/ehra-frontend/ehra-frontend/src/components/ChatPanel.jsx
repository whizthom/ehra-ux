import { useState, useEffect, useCallback, useRef } from "react";
import {
  getEmployerContacts,
  getMyContacts,
  getThread,
  sendChatMessage,
} from "../api/chatApi";
import useMessageStream from "../hooks/useMessageStream";
import styles from "./ChatPanel.module.css";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function bubbleTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function kindLabel(kind) {
  if (kind === "EMPLOYER") return "Employer";
  if (kind === "HOD") return "Head of Department";
  if (kind === "TEAM_MEMBER") return "Team member";
  return null;
}

// Groups messages into day buckets so a date divider can be shown once
// per day instead of on every single bubble.
function groupByDay(messages) {
  const groups = [];
  let currentDay = null;
  let bucket = null;
  for (const m of messages) {
    const label = dayLabel(m.createdAt);
    if (label !== currentDay) {
      currentDay = label;
      bucket = { label, messages: [] };
      groups.push(bucket);
    }
    bucket.messages.push(m);
  }
  return groups;
}

export default function ChatPanel({ viewer = "employee", onThreadOpenChange }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selected, setSelected] = useState(null); // the contact row object
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const showingDetail = Boolean(selected);
  const scrollRef = useRef(null);
  const selectedRef = useRef(null); // mirrors `selected` for use inside SSE callbacks
  selectedRef.current = selected;

  const fetchContacts = useCallback(async () => {
    try {
      const { data } =
        viewer === "admin"
          ? await getEmployerContacts()
          : await getMyContacts();
      setContacts(data);
      return data;
    } catch (err) {
      console.error("Failed to load contacts:", err);
      return [];
    } finally {
      setLoadingContacts(false);
    }
  }, [viewer]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const fetchThread = useCallback(async (withKey) => {
    setLoadingThread(true);
    try {
      const { data } = await getThread(withKey);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load thread:", err);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const openContact = (contact) => {
    setSelected(contact);
    fetchThread(contact.withKey);
    // Opening a thread marks it read server-side — reflect that locally
    // right away rather than waiting on a refetch.
    setContacts((prev) =>
      prev.map((c) =>
        c.withKey === contact.withKey ? { ...c, unreadCount: 0 } : c,
      ),
    );
  };

  const goBack = () => {
    setSelected(null);
    setMessages([]);
  };

  // Always land at the newest message when the thread changes.
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Tell the parent page whenever a thread is opened/closed — it decides
  // what to do with that on mobile (hide its topbar/logo/bottom nav so the
  // thread reads as a genuine full-screen view, same as most chat apps).
  useEffect(() => {
    onThreadOpenChange?.(showingDetail);
    // Leaving the page mid-thread shouldn't leave chrome permanently hidden.
    return () => onThreadOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingDetail]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selected || sending) return;
    setSending(true);
    setDraft("");
    try {
      const { data } = await sendChatMessage(selected.withKey, body);
      setMessages((prev) => [...prev, data]);
      setContacts((prev) => {
        const next = prev.map((c) =>
          c.withKey === selected.withKey
            ? {
                ...c,
                conversationId: data.conversationId,
                lastMessage: body,
                lastMessageAt: data.createdAt,
              }
            : c,
        );
        // bubble the active contact to the top, same as any chat app
        const idx = next.findIndex((c) => c.withKey === selected.withKey);
        if (idx > 0) next.unshift(next.splice(idx, 1)[0]);
        return next;
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      setDraft(body); // give it back so nothing typed is lost
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Real-time ────────────────────────────────────────────────────────────
  useMessageStream({
    onNewChatMessage: (payload) => {
      const current = selectedRef.current;
      if (current && current.conversationId === payload.conversationId) {
        setMessages((prev) => [...prev, payload]);
        fetchThread(current.withKey); // re-marks the thread read server-side
      }
      fetchContacts();
    },
    onChatRead: (payload) => {
      const current = selectedRef.current;
      if (current && current.conversationId === payload.conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.fromMe ? { ...m, read: true } : m)),
        );
      }
    },
  });

  const dayGroups = groupByDay(messages);

  return (
    <div
      className={`${styles.container} ${showingDetail ? styles.showDetail : ""}`}
    >
      {/* ── Contact list ── */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Chats</h2>
        </div>

        <div className={styles.list}>
          {loadingContacts ? (
            <p className={styles.emptyText}>Loading conversations…</p>
          ) : contacts.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-message-off ${styles.emptyIcon}`} />
              <p>No one to chat with yet.</p>
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c.withKey}
                className={`${styles.contactRow} ${selected?.withKey === c.withKey ? styles.active : ""}`}
                onClick={() => openContact(c)}
              >
                <div className={styles.avatar}>
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" />
                  ) : (
                    <span>{initials(c.name)}</span>
                  )}
                </div>
                <div className={styles.contactMain}>
                  <div className={styles.contactTop}>
                    <span className={styles.contactName}>{c.name}</span>
                    {c.lastMessageAt && (
                      <span className={styles.contactTime}>
                        {timeAgo(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className={styles.contactBottom}>
                    <span className={styles.contactPreview}>
                      {c.lastMessage ||
                        (kindLabel(c.kind)
                          ? `Say hello to your ${kindLabel(c.kind).toLowerCase()}`
                          : "Start a conversation")}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className={styles.unreadBadge}>
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className={styles.threadPanel}>
        {selected ? (
          <>
            <div className={styles.threadHeader}>
              <button className={styles.backBtn} onClick={goBack}>
                <i className="ti ti-arrow-left" />
              </button>
              <div className={styles.avatar}>
                {selected.avatarUrl ? (
                  <img src={selected.avatarUrl} alt="" />
                ) : (
                  <span>{initials(selected.name)}</span>
                )}
              </div>
              <div className={styles.threadHeaderInfo}>
                <span className={styles.threadName}>{selected.name}</span>
                {kindLabel(selected.kind) && (
                  <span className={styles.threadKind}>
                    {kindLabel(selected.kind)}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.messages} ref={scrollRef}>
              {loadingThread ? (
                <p className={styles.emptyText}>Loading messages…</p>
              ) : messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className={`ti ti-message-circle ${styles.emptyIcon}`} />
                  <p>No messages yet — say hello.</p>
                </div>
              ) : (
                dayGroups.map((group, gi) => (
                  <div key={gi}>
                    <div className={styles.dayDivider}>
                      <span>{group.label}</span>
                    </div>
                    {group.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.bubbleRow} ${m.fromMe ? styles.fromMe : styles.fromThem}`}
                      >
                        <div className={styles.bubble}>
                          <span className={styles.bubbleBody}>{m.body}</span>
                          <span className={styles.bubbleMeta}>
                            {bubbleTime(m.createdAt)}
                            {m.fromMe && (
                              <i
                                className={`ti ${m.read ? "ti-checks" : "ti-check"} ${styles.bubbleTick} ${m.read ? styles.tickRead : ""}`}
                              />
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className={styles.composer}>
              <textarea
                className={styles.composerInput}
                placeholder="Type a message"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Send"
              >
                <i className="ti ti-send" />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.placeholder}>
            <i className={`ti ti-message-circle-2 ${styles.placeholderIcon}`} />
            <p className={styles.placeholderTitle}>Select a conversation</p>
            <p className={styles.placeholderSub}>
              Pick someone from the list to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
