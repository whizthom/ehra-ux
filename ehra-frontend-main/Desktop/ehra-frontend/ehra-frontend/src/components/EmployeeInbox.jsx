import { useState } from "react";
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

/**
 * Presentational inbox view — fetching, SSE subscription, and unread-count
 * tracking all live in EmployeeDashboard now, so the sidebar badge and live
 * updates keep working even while this component isn't mounted (i.e. while
 * the person is on a different tab).
 */
export default function EmployeeInbox({
  messages = [],
  loading,
  newBanner,
  onSelectMessage,
}) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (msg) => {
    setSelected(msg);
    if (!msg.readByMe) onSelectMessage?.(msg.id);
  };

  // Keep the open detail view in sync once its read state updates (e.g.
  // after onSelectMessage resolves and the parent's messages array updates).
  const selectedFresh = selected
    ? (messages.find((m) => m.id === selected.id) ?? selected)
    : null;

  const unreadCount = messages.filter((m) => !m.readByMe).length;

  return (
    <div className={styles.container}>
      {newBanner && (
        <div className={styles.newBanner}>
          <i className="ti ti-bell-ringing" /> New message:{" "}
          <strong>{newBanner}</strong>
        </div>
      )}

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
            <p className={styles.empty}>Loading messages…</p>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <i
                className="ti ti-inbox-off"
                style={{ fontSize: 32, color: "var(--text-secondary)" }}
              />
              <p>No messages yet</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Messages from your admin will appear here.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.listItem} ${selectedFresh?.id === msg.id ? styles.active : ""} ${!msg.readByMe ? styles.unread : ""}`}
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
                  <i className="ti ti-user-circle" style={{ fontSize: 12 }} />
                  {msg.senderName}
                  {msg.broadcast && (
                    <span className={styles.broadcastTag}>
                      <i className="ti ti-speakerphone" /> Broadcast
                    </span>
                  )}
                </div>
                <div className={styles.listItemPreview}>
                  {msg.body?.slice(0, 80)}
                  {msg.body?.length > 80 ? "…" : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.detailPanel}>
        {selectedFresh ? (
          <div className={styles.detailArea}>
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailSubject}>
                  {selectedFresh.subject}
                </h3>
                <div className={styles.detailMeta}>
                  <span>
                    <i className="ti ti-user-circle" /> From{" "}
                    {selectedFresh.senderName}
                  </span>
                  <span>
                    <i className="ti ti-calendar" />{" "}
                    {formatDate(selectedFresh.createdAt)}
                  </span>
                  {selectedFresh.broadcast && (
                    <span className={styles.broadcastTag}>
                      <i className="ti ti-speakerphone" /> Sent to all employees
                    </span>
                  )}
                  {selectedFresh.readByMe && (
                    <span className={styles.readTag}>
                      <i className="ti ti-check" /> Read
                    </span>
                  )}
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelected(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className={styles.detailBody}>{selectedFresh.body}</div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <i
              className="ti ti-mail-opened"
              style={{ fontSize: 48, color: "var(--text-secondary)" }}
            />
            <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>
              {messages.length === 0
                ? "No messages in your inbox yet"
                : "Select a message to read it"}
            </p>
            {unreadCount > 0 && (
              <p
                style={{
                  color: "var(--accent)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
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
