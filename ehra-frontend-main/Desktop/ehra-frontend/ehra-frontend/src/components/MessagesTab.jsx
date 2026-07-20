import { useState, useEffect, useCallback } from "react";
import {
  getAllAnnouncements,
  sendAnnouncement,
  deleteAnnouncement,
} from "../api/notificationApi";
import useMessageStream from "../hooks/useMessageStream";
import styles from "./MessagesTab.module.css";

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

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function MessagesTab({ employees = [] }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientId, setRecipientId] = useState("all");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id to confirm
  const [deleting, setDeleting] = useState(false);

  // On phones the list and the open message/compose form can't share the
  // screen, so we show one at a time. This flag drives that via a single
  // CSS class rather than duplicating markup for two layouts.
  const showingDetail = Boolean(selected || composing);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getAllAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Real-time: update read counts (and who-read-it) live ───────────────
  useMessageStream({
    onReadUpdate: (payload) => {
      const applyUpdate = (a) => {
        if (a.id !== payload.announcementId) return a;
        let receipts = a.receipts;
        if (receipts && payload.reader) {
          receipts = receipts.map((r) =>
            r.employeeId === payload.reader.employeeId
              ? { ...r, read: true, readAt: payload.reader.readAt }
              : r,
          );
          // Keep read recipients first, most-recently-read first.
          receipts = [...receipts].sort((x, y) => {
            if (x.read !== y.read) return x.read ? -1 : 1;
            if (!x.readAt || !y.readAt) return 0;
            return new Date(y.readAt) - new Date(x.readAt);
          });
        }
        return {
          ...a,
          readCount: payload.readCount,
          totalRecipients: payload.totalRecipients,
          ...(receipts ? { receipts } : {}),
        };
      };
      setAnnouncements((prev) => prev.map(applyUpdate));
      setSelected((prev) => (prev ? applyUpdate(prev) : prev));
    },
  });

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(deleteConfirm);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteConfirm));
      if (selected?.id === deleteConfirm) setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      alert("Failed to delete message. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSend = async () => {
    setSendError("");
    if (!subject.trim()) {
      setSendError("Please enter a subject.");
      return;
    }
    if (!body.trim()) {
      setSendError("Please write a message body.");
      return;
    }
    setSending(true);
    try {
      await sendAnnouncement({
        subject: subject.trim(),
        body: body.trim(),
        recipientEmployeeId:
          recipientId === "all" ? undefined : Number(recipientId),
      });
      setSendSuccess(true);
      await fetchAll();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Failed to send.";
      setSendError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setSubject("");
    setBody("");
    setRecipientId("all");
    setSendError("");
    setSendSuccess(false);
    setComposing(false);
  };

  const goBack = () => {
    setSelected(null);
    resetCompose();
  };

  return (
    <div
      className={`${styles.container} ${showingDetail ? styles.showDetail : ""}`}
    >
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            <i className="ti ti-mail" /> Messages
            <span className={styles.count}>{announcements.length}</span>
          </h2>
          <button
            className={styles.composeBtn}
            onClick={() => {
              setComposing(true);
              setSelected(null);
            }}
          >
            <i className="ti ti-pencil-plus" />
            <span className={styles.composeBtnLabel}>New message</span>
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <p className={styles.empty}>Loading messages…</p>
          ) : announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-mail-off ${styles.emptyIcon}`} />
              <p>No messages sent yet.</p>
              <p className={styles.emptySub}>
                Use "New message" to send an announcement.
              </p>
            </div>
          ) : (
            announcements.map((a) => {
              const readPct =
                a.totalRecipients > 0
                  ? Math.round((a.readCount / a.totalRecipients) * 100)
                  : 0;
              const allRead =
                a.readCount === a.totalRecipients && a.totalRecipients > 0;
              return (
                <div
                  key={a.id}
                  className={`${styles.listItem} ${selected?.id === a.id ? styles.active : ""}`}
                  onClick={() => {
                    setSelected(a);
                    setComposing(false);
                  }}
                >
                  <div className={styles.listItemTop}>
                    <div className={styles.listItemSubject}>{a.subject}</div>
                    <div className={styles.listItemTime}>
                      {timeAgo(a.createdAt)}
                    </div>
                  </div>
                  <div className={styles.listItemPreview}>
                    {a.body?.slice(0, 80)}
                    {a.body?.length > 80 ? "…" : ""}
                  </div>
                  <div className={styles.listItemMeta}>
                    {a.broadcast ? (
                      <span className={styles.tagBroadcast}>
                        <i className="ti ti-speakerphone" /> All employees
                      </span>
                    ) : (
                      <span className={styles.tagDirect}>
                        <i className="ti ti-user" /> {a.recipientName}
                      </span>
                    )}
                    <span
                      className={
                        allRead ? styles.readBadgeGreen : styles.readBadge
                      }
                    >
                      <i className={`ti ${allRead ? "ti-checks" : "ti-eye"}`} />
                      {a.readCount}/{a.totalRecipients} read ({readPct}%)
                    </span>
                    <button
                      className={styles.deleteListBtn}
                      title="Delete message"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(a.id);
                      }}
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.detailPanel}>
        {composing ? (
          <div className={styles.composeArea}>
            <div className={styles.detailHeader}>
              <button className={styles.backBtn} onClick={goBack}>
                <i className="ti ti-arrow-left" />
                <span className={styles.backBtnLabel}>Messages</span>
              </button>
              <h3 className={styles.detailSubject}>New message</h3>
            </div>

            {sendSuccess ? (
              <div className={styles.successBox}>
                <i className={`ti ti-circle-check ${styles.successIcon}`} />
                <p className={styles.successTitle}>Message sent!</p>
                <p className={styles.successSub}>
                  Delivered instantly. Employees will see it in their inbox
                  right now.
                </p>
                <button className={styles.composeBtn} onClick={resetCompose}>
                  Back to inbox
                </button>
              </div>
            ) : (
              <>
                {sendError && (
                  <div className={styles.errorBox}>
                    <i className="ti ti-alert-circle" /> {sendError}
                  </div>
                )}
                <div className={styles.field}>
                  <label>To</label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                  >
                    <option value="all">All active employees</option>
                    {employees
                      .filter((e) => e.status === "ACTIVE")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {[e.firstName, e.lastName].filter(Boolean).join(" ")}{" "}
                          — {e.email}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Office closed on Friday"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label>Message</label>
                  <textarea
                    rows={8}
                    placeholder="Write your announcement here…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
                <div className={styles.composeFooter}>
                  <button className={styles.cancelBtn} onClick={resetCompose}>
                    Cancel
                  </button>
                  <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={sending}
                  >
                    <i className="ti ti-send" />
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : selected ? (
          <div className={styles.detailArea}>
            <div className={styles.detailHeader}>
              <button className={styles.backBtn} onClick={goBack}>
                <i className="ti ti-arrow-left" />
                <span className={styles.backBtnLabel}>Messages</span>
              </button>
              <h3 className={styles.detailSubject}>{selected.subject}</h3>
              <button
                className={styles.deleteDetailBtn}
                title="Delete message"
                onClick={() => setDeleteConfirm(selected.id)}
              >
                <i className="ti ti-trash" />
                <span className={styles.deleteDetailLabel}>Delete</span>
              </button>
            </div>
            <div className={styles.detailMeta}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Sent</span>
                <span>{formatDate(selected.createdAt)}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>To</span>
                <span>
                  {selected.broadcast
                    ? "All active employees"
                    : selected.recipientName}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Read receipts</span>
                <span
                  className={
                    selected.readCount === selected.totalRecipients &&
                    selected.totalRecipients > 0
                      ? styles.readBadgeGreen
                      : styles.readBadge
                  }
                >
                  <i
                    className={`ti ${selected.readCount === selected.totalRecipients && selected.totalRecipients > 0 ? "ti-checks" : "ti-eye"}`}
                  />
                  {selected.readCount} of {selected.totalRecipients} recipient
                  {selected.totalRecipients !== 1 ? "s" : ""} have read this
                  <span className={styles.liveTag}>
                    <i className="ti ti-antenna-bars-5" /> live
                  </span>
                </span>
              </div>
            </div>

            {selected.totalRecipients > 0 && (
              <div className={styles.readProgress}>
                <div
                  className={styles.readProgressBar}
                  style={{
                    width: `${Math.round((selected.readCount / selected.totalRecipients) * 100)}%`,
                  }}
                />
              </div>
            )}

            {selected.receipts && (
              <div className={styles.receiptsSection}>
                <div className={styles.receiptsHeader}>
                  <span className={styles.receiptsTitle}>Recipients</span>
                  <span className={styles.readBadge}>
                    {selected.readCount}/{selected.totalRecipients} read
                  </span>
                </div>
                {selected.receipts.length === 0 ? (
                  <div className={styles.receiptsList}>
                    <p className={styles.receiptsEmpty}>
                      No recipients for this message.
                    </p>
                  </div>
                ) : (
                  <div className={styles.receiptsList}>
                    {selected.receipts.map((r) => (
                      <div
                        key={r.employeeId}
                        className={`${styles.receiptRow} ${!r.read ? styles.unreadRow : ""}`}
                      >
                        <div className={styles.receiptAvatar}>
                          {r.employeeProfilePictureUrl ? (
                            <img src={r.employeeProfilePictureUrl} alt="" />
                          ) : (
                            initials(r.employeeName)
                          )}
                        </div>
                        <div className={styles.receiptInfo}>
                          <div className={styles.receiptName}>
                            {r.employeeName}
                          </div>
                          <div className={styles.receiptEmail}>
                            {r.employeeEmail}
                          </div>
                        </div>
                        <div
                          className={`${styles.receiptStatus} ${
                            r.read ? styles.readStatus : styles.unreadStatus
                          }`}
                        >
                          <i
                            className={`ti ${r.read ? "ti-check" : "ti-clock"}`}
                          />
                          {r.read
                            ? `Read ${formatDate(r.readAt)}`
                            : "Not read yet"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={styles.detailBody}>{selected.body}</div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <i className={`ti ti-mail ${styles.placeholderIcon}`} />
            <p className={styles.placeholderTitle}>
              Select a message to view it
            </p>
            <p className={styles.placeholderSub}>
              or compose a new one for your team
            </p>
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      {deleteConfirm && (
        <div
          className={styles.confirmOverlay}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            className={styles.confirmBox}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <i className="ti ti-trash" />
            </div>
            <h4 className={styles.confirmTitle}>Delete this message?</h4>
            <p className={styles.confirmText}>
              This message will be permanently removed from all employees'
              inboxes immediately. This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={handleDelete}
                disabled={deleting}
              >
                <i className="ti ti-trash" />
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
