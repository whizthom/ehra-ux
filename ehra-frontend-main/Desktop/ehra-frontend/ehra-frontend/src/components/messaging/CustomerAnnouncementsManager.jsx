import { useCallback, useEffect, useState } from "react";
import {
  deleteCustomerAnnouncement,
  getCustomerAnnouncement,
  listCustomerAnnouncements,
  sendCustomerAnnouncement,
} from "../../api/customerAnnouncementApi";
import { subscribeToUserQueue } from "../../services/messagingSocket";
import styles from "../MessagesTab.module.css";

// The business side of "announce to all my customers": compose a subject +
// message once, it lands in EVERY linked customer's Announcements inbox at
// once (live if they're online), and this view then shows who has read it.
//
// It deliberately reuses MessagesTab's stylesheet (and its list / detail /
// compose / read-receipt layout) so it is visually and behaviourally the
// same tool the employer already knows from the employee announcements -
// only the audience and the data source differ. Available to the employer,
// and to employees the employer has allowed to message customers (the
// server enforces that; an employee without it never reaches this screen).

const SUBJECT_MAX = 160;
const BODY_MAX = 5000;

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

function errorText(err, fallback) {
  const msg = err?.response?.data?.message || err?.response?.data;
  return typeof msg === "string" && msg ? msg : fallback;
}

export default function CustomerAnnouncementsManager({ onDetailOpenChange }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(null); // the sent announcement
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  // On phones the list and the open message/compose form can't share the
  // screen - same single-flag approach as MessagesTab.
  const showingDetail = Boolean(selected || composing);

  useEffect(() => {
    onDetailOpenChange?.(showingDetail);
    return () => onDetailOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingDetail]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const { data } = await listCustomerAnnouncements();
      setAnnouncements(data || []);
    } catch (err) {
      setLoadError(errorText(err, "Couldn't load your announcements."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data } = await listCustomerAnnouncements();
        if (!dead) setAnnouncements(data || []);
      } catch (err) {
        if (!dead) setLoadError(errorText(err, "Couldn't load your announcements."));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Live read receipts: a customer opening the announcement updates the
  // counts (and, if it's open here, flips their row to "read") instantly.
  useEffect(() => {
    return subscribeToUserQueue((event) => {
      if (!event || event.type !== "CUSTOMER_ANNOUNCEMENT_READ") return;
      const p = event.payload;
      const apply = (a) => {
        if (a.id !== p.announcementId) return a;
        let receipts = a.receipts;
        if (receipts) {
          receipts = receipts
            .map((r) =>
              r.customerIdentityId === p.customerIdentityId
                ? { ...r, read: true, readAt: p.readAt }
                : r,
            )
            .sort((x, y) => {
              if (x.read !== y.read) return x.read ? -1 : 1;
              if (!x.readAt || !y.readAt) return 0;
              return new Date(y.readAt) - new Date(x.readAt);
            });
        }
        return {
          ...a,
          readCount: p.readCount,
          totalRecipients: p.totalRecipients,
          ...(receipts ? { receipts } : {}),
        };
      };
      setAnnouncements((prev) => prev.map(apply));
      setSelected((prev) => (prev ? apply(prev) : prev));
    });
  }, []);

  const openAnnouncement = async (a) => {
    setSelected(a);
    setComposing(false);
    setRecipientsOpen(false);
    try {
      // The list only carries counts; the receipts come with the detail.
      const { data } = await getCustomerAnnouncement(a.id);
      setSelected((prev) => (prev && prev.id === a.id ? { ...prev, ...data } : prev));
    } catch {
      // The list data is enough to read it; receipts just won't show.
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteCustomerAnnouncement(deleteConfirm);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteConfirm));
      if (selected?.id === deleteConfirm) setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteConfirm(null);
      setLoadError(errorText(err, "Couldn't delete that announcement. Please try again."));
    } finally {
      setDeleting(false);
    }
  };

  const validate = () => {
    if (!subject.trim()) return "Please enter a subject.";
    if (!body.trim()) return "Please write your message.";
    return "";
  };

  const requestSend = () => {
    const problem = validate();
    if (problem) {
      setSendError(problem);
      return;
    }
    setSendError("");
    setConfirmSend(true);
  };

  const handleSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const { data } = await sendCustomerAnnouncement({
        subject: subject.trim(),
        body: body.trim(),
      });
      setConfirmSend(false);
      setSendSuccess(data);
      await fetchAll();
    } catch (err) {
      setConfirmSend(false);
      setSendError(errorText(err, "Failed to send. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setSubject("");
    setBody("");
    setSendError("");
    setSendSuccess(null);
    setConfirmSend(false);
    setComposing(false);
  };

  const goBack = () => {
    setSelected(null);
    resetCompose();
  };

  return (
    <div className={`${styles.container} ${showingDetail ? styles.showDetail : ""}`}>
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            <i className="ti ti-speakerphone" /> Announcements
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
            <span className={styles.composeBtnLabel}>New announcement</span>
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <p className={styles.empty}>Loading announcements…</p>
          ) : loadError && announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-alert-triangle ${styles.emptyIcon}`} />
              <p>{loadError}</p>
              <button className={styles.composeBtn} onClick={fetchAll}>
                Try again
              </button>
            </div>
          ) : announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <i className={`ti ti-speakerphone ${styles.emptyIcon}`} />
              <p>No announcements sent yet.</p>
              <p className={styles.emptySub}>
                Tell every customer about a sale, new stock or a change of hours - all at once.
              </p>
            </div>
          ) : (
            announcements.map((a) => {
              const readPct =
                a.totalRecipients > 0 ? Math.round((a.readCount / a.totalRecipients) * 100) : 0;
              const allRead = a.readCount === a.totalRecipients && a.totalRecipients > 0;
              return (
                <div
                  key={a.id}
                  className={`${styles.listItem} ${selected?.id === a.id ? styles.active : ""}`}
                  onClick={() => openAnnouncement(a)}
                >
                  <div className={styles.listItemTop}>
                    <div className={styles.listItemSubject}>{a.subject}</div>
                    <div className={styles.listItemTime}>{timeAgo(a.createdAt)}</div>
                  </div>
                  <div className={styles.listItemPreview}>
                    {a.body?.slice(0, 80)}
                    {a.body?.length > 80 ? "…" : ""}
                  </div>
                  <div className={styles.listItemMeta}>
                    <span className={styles.tagBroadcast}>
                      <i className="ti ti-users" /> All customers
                    </span>
                    <span className={allRead ? styles.readBadgeGreen : styles.readBadge}>
                      <i className={`ti ${allRead ? "ti-checks" : "ti-eye"}`} />
                      {a.readCount}/{a.totalRecipients} read ({readPct}%)
                    </span>
                    <button
                      className={styles.deleteListBtn}
                      title="Delete announcement"
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
                <span className={styles.backBtnLabel}>Announcements</span>
              </button>
              <h3 className={styles.detailSubject}>New announcement</h3>
            </div>

            {sendSuccess ? (
              <div className={styles.successBox}>
                <i className={`ti ti-circle-check ${styles.successIcon}`} />
                <p className={styles.successTitle}>Announcement sent!</p>
                <p className={styles.successSub}>
                  Delivered to {sendSuccess.totalRecipients} customer
                  {sendSuccess.totalRecipients !== 1 ? "s" : ""}. Customers who are online see it
                  right now; everyone else sees it next time they open Ehral. Customers can reply
                  to it, and their replies arrive in your customer chats.
                </p>
                <button className={styles.composeBtn} onClick={resetCompose}>
                  Back to announcements
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
                  <div className={styles.audienceChip}>
                    <i className="ti ti-users" />
                    <span>
                      <strong>All customers</strong>
                      <small>Everyone linked to your business right now</small>
                    </span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekend sale - 20% off everything"
                    value={subject}
                    maxLength={SUBJECT_MAX}
                    onChange={(e) => setSubject(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label>Message</label>
                  <textarea
                    className={styles.messageInput}
                    rows={8}
                    placeholder="Write your announcement here…"
                    value={body}
                    maxLength={BODY_MAX}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <small className={styles.charCount}>
                    {body.length}/{BODY_MAX}
                  </small>
                </div>
                <div className={styles.composeFooter}>
                  <button className={styles.cancelBtn} onClick={resetCompose}>
                    Cancel
                  </button>
                  <button className={styles.sendBtn} onClick={requestSend} disabled={sending}>
                    <i className="ti ti-send" />
                    Send to all customers
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
                <span className={styles.backBtnLabel}>Announcements</span>
              </button>
              <h3 className={styles.detailSubject}>{selected.subject}</h3>
              <button
                className={styles.deleteDetailBtn}
                title="Delete announcement"
                onClick={() => setDeleteConfirm(selected.id)}
              >
                <i className="ti ti-trash" />
                <span className={styles.deleteDetailLabel}>Delete</span>
              </button>
            </div>
            <div className={styles.detailMeta}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Sent</span>
                <span>
                  {formatDate(selected.createdAt)}
                  {selected.senderName ? ` by ${selected.senderName}` : ""}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>To</span>
                <span>All customers</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Read receipts</span>
                <span
                  className={
                    selected.readCount === selected.totalRecipients && selected.totalRecipients > 0
                      ? styles.readBadgeGreen
                      : styles.readBadge
                  }
                >
                  <i
                    className={`ti ${selected.readCount === selected.totalRecipients && selected.totalRecipients > 0 ? "ti-checks" : "ti-eye"}`}
                  />
                  {selected.readCount} of {selected.totalRecipients} customer
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
                <button
                  type="button"
                  className={styles.receiptsHeader}
                  onClick={() => setRecipientsOpen((v) => !v)}
                  aria-expanded={recipientsOpen}
                >
                  <span className={styles.receiptsTitle}>
                    <i
                      className={`ti ti-chevron-right ${styles.receiptsChevron} ${recipientsOpen ? styles.receiptsChevronOpen : ""}`}
                    />
                    Customers
                  </span>
                  <span className={styles.readBadge}>
                    {selected.readCount}/{selected.totalRecipients} read
                  </span>
                </button>
                {recipientsOpen &&
                  (selected.receipts.length === 0 ? (
                    <div className={styles.receiptsList}>
                      <p className={styles.receiptsEmpty}>No recipients for this announcement.</p>
                    </div>
                  ) : (
                    <div className={styles.receiptsList}>
                      {selected.receipts.map((r) => (
                        <div
                          key={r.customerIdentityId}
                          className={`${styles.receiptRow} ${!r.read ? styles.unreadRow : ""}`}
                        >
                          <div className={styles.receiptAvatar}>
                            {r.customerProfileImage ? (
                              <img src={r.customerProfileImage} alt="" />
                            ) : (
                              initials(r.customerName)
                            )}
                          </div>
                          <div className={styles.receiptInfo}>
                            <div className={styles.receiptName}>{r.customerName}</div>
                          </div>
                          <div
                            className={`${styles.receiptStatus} ${
                              r.read ? styles.readStatus : styles.unreadStatus
                            }`}
                          >
                            <i className={`ti ${r.read ? "ti-check" : "ti-clock"}`} />
                            {r.read ? `Read ${formatDate(r.readAt)}` : "Not read yet"}
                          </div>
                        </div>
                      ))}
                      {selected.totalRecipients > selected.receipts.length && (
                        <p className={styles.receiptsEmpty}>
                          Showing the first {selected.receipts.length} of {selected.totalRecipients}{" "}
                          customers.
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className={styles.detailBody}>{selected.body}</div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <i className={`ti ti-speakerphone ${styles.placeholderIcon}`} />
            <p className={styles.placeholderTitle}>Select an announcement to view it</p>
            <p className={styles.placeholderSub}>or write a new one for all your customers</p>
          </div>
        )}
      </div>

      {/* Sending to every customer is not undoable - confirm first. */}
      {confirmSend && (
        <div className={styles.confirmOverlay} onClick={() => !sending && setConfirmSend(false)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.confirmIcon} ${styles.confirmIconAccent}`}>
              <i className="ti ti-speakerphone" />
            </div>
            <h4 className={styles.confirmTitle}>Send to all customers?</h4>
            <p className={styles.confirmText}>
              "{subject.trim()}" will be delivered to every customer linked to your business right
              now. You can delete it afterwards, but customers who already saw it will have seen it.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmSend(false)}
                disabled={sending}
              >
                Keep editing
              </button>
              <button className={styles.sendBtn} onClick={handleSend} disabled={sending}>
                <i className="ti ti-send" />
                {sending ? "Sending…" : "Send now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className={styles.confirmOverlay} onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <i className="ti ti-trash" />
            </div>
            <h4 className={styles.confirmTitle}>Delete this announcement?</h4>
            <p className={styles.confirmText}>
              It will be removed from every customer's inbox immediately. This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className={styles.confirmDeleteBtn} onClick={handleDelete} disabled={deleting}>
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
