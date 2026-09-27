import { useState } from "react";
import { broadcastMessage } from "../api/notificationApi";
import styles from "./SendMessageModal.module.css";

/**
 * Lets the admin send a free-text message to every active employee.
 * Each employee receives their own notification (type ADMIN_MESSAGE) on
 * their dashboard's Notifications tab.
 */
export default function SendMessageModal({ open, onClose, onSent }) {
  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setTitle("");
    setMessage("");
    setError("");
    setSent(false);
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    if (!message.trim()) {
      setError("Please write a message before sending.");
      return;
    }
    setLoading(true);
    try {
      await broadcastMessage({ title: title.trim() || undefined, message: message.trim() });
      setSent(true);
      onSent?.();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data || "Failed to send message.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Send message to all employees</h3>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          {sent ? (
            <div className={styles.successBox}>
              <i className="ti ti-circle-check" style={{ fontSize: 28 }} aria-hidden="true" />
              <p>Message sent! Every active employee will see it on their dashboard.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className={styles.errorBox}>
                  <span>⚠</span><span>{error}</span>
                </div>
              )}

              <div className={styles.field}>
                <label>Title <span className={styles.optional}>(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Office closed Friday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label>Message *</label>
                <textarea
                  rows={5}
                  placeholder="Write your announcement here…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose} type="button">
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button className={styles.sendBtn} onClick={handleSubmit} disabled={loading} type="button">
              {loading ? "Sending…" : "Send to all employees"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
