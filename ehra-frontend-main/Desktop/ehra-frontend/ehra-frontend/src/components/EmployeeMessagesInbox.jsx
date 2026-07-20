import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMyAnnouncements,
  markAnnouncementRead,
} from "../api/notificationApi";
import styles from "./EmployeeInbox.module.css";

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
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Placeholder rows shown while the first fetch is in flight — a shimmering
// approximation of real list items reads as "this is already loading" far
// faster than a static "Loading…" line, which is most of what "responsive"
// means in a UI that's actually waiting on the network.
function SkeletonRows() {
  return (
    <div className={styles.skeletonList} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className={styles.skeletonItem} key={i}>
          <div className={styles.skeletonLine} style={{ width: "70%" }} />
          <div className={styles.skeletonLine} style={{ width: "40%" }} />
          <div className={styles.skeletonLine} style={{ width: "90%" }} />
        </div>
      ))}
    </div>
  );
}

// How far (in px) a rightward drag has to travel before it counts as
// "go back" rather than "changed your mind" and should snap shut again.
const SWIPE_DISMISS_THRESHOLD = 90;

export default function EmployeeInbox({ onUnreadCountChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);

  // Drives the mobile layout: below the breakpoint, list and detail can't
  // sit side by side, so the detail panel slides over the list instead.
  const showingDetail = Boolean(selected);

  // ── Swipe-to-go-back (touch only — mirrors the native "swipe from the
  // left edge" gesture people already know from Mail/Messages apps) ──────
  // Manipulates the DOM node directly via a ref instead of pushing every
  // touchmove through React state: at 60fps that's the difference between
  // a panel that tracks your finger exactly and one that visibly lags.
  const panelRef = useRef(null);
  const dragState = useRef({ startX: 0, dx: 0, active: false });

  const handleTouchStart = (e) => {
    dragState.current = {
      startX: e.touches[0].clientX,
      dx: 0,
      active: true,
    };
    if (panelRef.current) panelRef.current.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.current.active || !panelRef.current) return;
    const dx = e.touches[0].clientX - dragState.current.startX;
    if (dx <= 0) return; // only rightward (back) swipes move the panel
    const clamped = Math.min(dx, panelRef.current.offsetWidth);
    dragState.current.dx = clamped;
    panelRef.current.style.transform = `translateX(${clamped}px)`;
  };

  const handleTouchEnd = () => {
    if (!dragState.current.active || !panelRef.current) return;
    dragState.current.active = false;
    panelRef.current.style.transition = "";
    panelRef.current.style.transform = "";
    if (dragState.current.dx > SWIPE_DISMISS_THRESHOLD) {
      setSelected(null);
    }
  };

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getMyAnnouncements();
      setMessages(data);
      // Notify parent of unread count
      const unread = data.filter((m) => !m.readByMe).length;
      onUnreadCountChange?.(unread);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSelect = async (msg) => {
    setSelected(msg);
    if (!msg.readByMe) {
      setMarkingRead(true);
      try {
        await markAnnouncementRead(msg.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, readByMe: true } : m)),
        );
        setSelected((prev) => (prev ? { ...prev, readByMe: true } : prev));
        // Update parent badge
        const newUnread = messages.filter(
          (m) => !m.readByMe && m.id !== msg.id,
        ).length;
        onUnreadCountChange?.(newUnread);
      } catch (err) {
        console.error("Failed to mark as read:", err);
      } finally {
        setMarkingRead(false);
      }
    }
  };

  const unreadCount = messages.filter((m) => !m.readByMe).length;

  return (
    <div
      className={`${styles.container} ${showingDetail ? styles.showDetail : ""}`}
    >
      {/* ── Left: message list (full-width on phones, sidebar on desktop) ── */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            <i className="ti ti-inbox" /> Inbox
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount} unread</span>
            )}
          </h2>
        </div>

        <div className={styles.list}>
          {loading ? (
            <SkeletonRows />
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-inbox-off ${styles.emptyIcon}`} />
              <p>No messages yet</p>
              <p className={styles.emptySub}>
                Messages from your admin will appear here.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
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
                  <div className={styles.listItemTime}>
                    {timeAgo(msg.createdAt)}
                  </div>
                </div>
                <div className={styles.listItemFrom}>
                  <i className="ti ti-user-circle" />
                  {msg.senderName}
                  {msg.broadcast && (
                    <span className={styles.broadcastTag}>
                      <i className="ti ti-speakerphone" /> Broadcast
                    </span>
                  )}
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

      {/* ── Right: detail view (overlays the list on phones, slides in) ── */}
      <div
        className={styles.detailPanel}
        ref={panelRef}
        onTouchStart={showingDetail ? handleTouchStart : undefined}
        onTouchMove={showingDetail ? handleTouchMove : undefined}
        onTouchEnd={showingDetail ? handleTouchEnd : undefined}
      >
        {selected ? (
          <div className={styles.detailArea}>
            <div className={styles.detailHeader}>
              <button
                className={styles.backBtn}
                onClick={() => setSelected(null)}
              >
                <i className="ti ti-arrow-left" />
                <span className={styles.backBtnLabel}>Inbox</span>
              </button>
              <h3 className={styles.detailSubject}>{selected.subject}</h3>
              {markingRead && (
                <span className={styles.markingSpinner}>
                  <i className="ti ti-loader-2" />
                </span>
              )}
            </div>
            <div className={styles.detailMeta}>
              <span>
                <i className="ti ti-user-circle" /> From {selected.senderName}
              </span>
              <span>
                <i className="ti ti-calendar" />{" "}
                {formatDate(selected.createdAt)}
              </span>
              {selected.broadcast && (
                <span className={styles.broadcastTag}>
                  <i className="ti ti-speakerphone" /> Sent to all employees
                </span>
              )}
              {selected.readByMe && (
                <span className={styles.readTag}>
                  <i className="ti ti-check" /> Read
                </span>
              )}
            </div>

            <div className={styles.detailBody}>{selected.body}</div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <i className={`ti ti-mail-opened ${styles.placeholderIcon}`} />
            <p className={styles.placeholderTitle}>
              {messages.length === 0
                ? "No messages in your inbox yet"
                : "Select a message to read it"}
            </p>
            {unreadCount > 0 && (
              <p className={styles.placeholderSub}>
                You have {unreadCount} unread message
                {unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
