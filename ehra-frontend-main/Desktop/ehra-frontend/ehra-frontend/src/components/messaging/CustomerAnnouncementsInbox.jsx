import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listMyCustomerAnnouncements,
  markCustomerAnnouncementRead,
  replyToCustomerAnnouncement,
} from "../../api/customerAnnouncementApi";
import { subscribeToUserQueue } from "../../services/messagingSocket";
import styles from "../EmployeeInbox.module.css";
import extra from "./CustomerAnnouncementsInbox.module.css";

// The customer's side of business announcements: everything the businesses
// they follow have announced, newest first, unread highlighted, updating
// live. Opening one marks it read (which the business sees as a live read
// receipt). "Reply" answers it - the reply lands in the customer's shared
// chat with that business, tagged with the announcement it answers, and the
// hub jumps straight into that chat.
//
// Reuses the employee inbox's stylesheet (same list/detail layout the app
// already uses for announcements) plus a few additions for the business
// identity and the reply box.

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function BusinessAvatar({ name, logo, size = 38 }) {
  return (
    <span className={extra.bizAvatar} style={{ width: size, height: size }}>
      {logo ? <img src={logo} alt="" /> : initials(name)}
    </span>
  );
}

export default function CustomerAnnouncementsInbox({
  onDetailOpenChange,
  onUnreadCountChange,
  onOpenConversation,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState("");

  const showingDetail = Boolean(selected);

  useEffect(() => {
    onDetailOpenChange?.(showingDetail);
    return () => onDetailOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingDetail]);

  const unreadCount = useMemo(() => items.filter((m) => !m.readByMe).length, [items]);

  useEffect(() => {
    // Only report once the list has actually loaded - the initial empty
    // list would otherwise briefly zero the parent's badge.
    if (!loading) onUnreadCountChange?.(unreadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, loading]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await listMyCustomerAnnouncements();
      setItems(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't load your announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data } = await listMyCustomerAnnouncements();
        if (!dead) setItems(data || []);
      } catch (err) {
        if (!dead) setError(err?.response?.data?.message || "Couldn't load your announcements.");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Live: a business announces (appears at the top, unread) or retracts one.
  useEffect(() => {
    return subscribeToUserQueue((event) => {
      if (!event) return;
      if (event.type === "CUSTOMER_ANNOUNCEMENT_CREATED") {
        const incoming = event.payload;
        setItems((prev) =>
          prev.some((m) => m.id === incoming.id) ? prev : [{ ...incoming, readByMe: false }, ...prev],
        );
      } else if (event.type === "CUSTOMER_ANNOUNCEMENT_DELETED") {
        const id = event.payload?.announcementId;
        setItems((prev) => prev.filter((m) => m.id !== id));
        setSelected((prev) => (prev && prev.id === id ? null : prev));
      }
    });
  }, []);

  const handleSelect = async (msg) => {
    setSelected(msg);
    setReplyText("");
    setReplyError("");
    if (!msg.readByMe) {
      // Optimistic - the receipt call is fire-and-forget from the reader's
      // point of view; roll back only if the server refuses.
      setItems((prev) => prev.map((m) => (m.id === msg.id ? { ...m, readByMe: true } : m)));
      setSelected((prev) => (prev && prev.id === msg.id ? { ...prev, readByMe: true } : prev));
      try {
        await markCustomerAnnouncementRead(msg.id);
      } catch {
        setItems((prev) => prev.map((m) => (m.id === msg.id ? { ...m, readByMe: false } : m)));
      }
    }
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text || replying || !selected) return;
    setReplying(true);
    setReplyError("");
    try {
      const { data } = await replyToCustomerAnnouncement(selected.id, text);
      setReplyText("");
      onOpenConversation?.(data.conversationId, data.messageId);
    } catch (err) {
      setReplyError(err?.response?.data?.message || "Your reply couldn't be sent. Please try again.");
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className={`${styles.container} ${showingDetail ? styles.showDetail : ""}`}>
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            <i className="ti ti-speakerphone" /> Announcements
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount} unread</span>}
          </h2>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.skeletonList}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonItem}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} />
                </div>
              ))}
            </div>
          ) : error && items.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-alert-triangle ${styles.emptyIcon}`} />
              <p>{error}</p>
              <button className={extra.retryBtn} onClick={load}>
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-speakerphone ${styles.emptyIcon}`} />
              <p>No announcements yet</p>
              <p className={styles.emptySub}>
                When a business you follow announces something - a sale, new stock, a change of
                hours - it will appear here.
              </p>
            </div>
          ) : (
            items.map((msg, i) => (
              <div
                key={msg.id}
                className={`${styles.listItem} ${selected?.id === msg.id ? styles.active : ""} ${!msg.readByMe ? styles.unread : ""}`}
                style={{ "--stagger": i }}
                onClick={() => handleSelect(msg)}
              >
                <div className={styles.listItemTop}>
                  <div className={styles.listItemSubject}>
                    {!msg.readByMe && <span className={styles.unreadDot} />}
                    {msg.subject}
                  </div>
                  <div className={styles.listItemTime}>{timeAgo(msg.createdAt)}</div>
                </div>
                <div className={styles.listItemFrom}>
                  <BusinessAvatar name={msg.businessName} logo={msg.businessLogo} size={18} />
                  {msg.businessName}
                </div>
                <div className={styles.listItemPreview}>
                  {msg.body.slice(0, 80)}
                  {msg.body.length > 80 ? "…" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.detailPanel}>
        {selected ? (
          <div className={styles.detailArea}>
            <div className={styles.detailHeader}>
              <button className={styles.backBtn} onClick={() => setSelected(null)}>
                <i className="ti ti-arrow-left" />
                <span className={styles.backBtnLabel}>Announcements</span>
              </button>
              <h3 className={styles.detailSubject}>{selected.subject}</h3>
            </div>

            <div className={styles.senderRow}>
              <BusinessAvatar name={selected.businessName} logo={selected.businessLogo} size={42} />
              <div className={styles.senderInfo}>
                <span className={styles.senderName}>{selected.businessName}</span>
                <span className={styles.senderDate}>
                  {formatDate(selected.createdAt)}
                  {selected.senderName ? ` · ${selected.senderName}` : ""}
                </span>
              </div>
              {selected.readByMe && (
                <span className={styles.readTag}>
                  <i className="ti ti-check" /> Read
                </span>
              )}
            </div>

            <div className={styles.detailBody}>{selected.body}</div>

            <div className={extra.replyBox}>
              <label htmlFor="announcement-reply" className={extra.replyLabel}>
                <i className="ti ti-corner-up-left" /> Reply to {selected.businessName}
              </label>
              <textarea
                id="announcement-reply"
                className={extra.replyInput}
                rows={3}
                maxLength={4000}
                placeholder="Write a reply - it goes to the business's chat with you"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              {replyError && (
                <div className={extra.replyError}>
                  <i className="ti ti-alert-circle" /> {replyError}
                </div>
              )}
              <div className={extra.replyFooter}>
                <small>Your reply opens in your chat with {selected.businessName}.</small>
                <button
                  className={extra.replySend}
                  onClick={handleReply}
                  disabled={!replyText.trim() || replying}
                >
                  <i className={`ti ${replying ? "ti-loader-2" : "ti-send"}`} />
                  {replying ? "Sending…" : "Send reply"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <i className={`ti ti-mail-opened ${styles.placeholderIcon}`} />
            <p className={styles.placeholderTitle}>
              {items.length === 0 ? "No announcements yet" : "Select an announcement to read it"}
            </p>
            {unreadCount > 0 && (
              <p className={styles.placeholderSub}>
                You have {unreadCount} unread announcement{unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
