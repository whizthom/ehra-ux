import { useState, useEffect } from "react";
import { sendAnnouncement } from "../api/notificationApi";
import styles from "./QuickSendMessageModal.module.css";

export default function QuickSendMessageModal({
  open,
  onClose,
  initialRecipient = null, // {id, firstName, lastName} — when set, locks this message to just them
}) {
  const [target, setTarget] = useState("ALL"); // "ALL" | "HODS_ONLY" — irrelevant when initialRecipient is set
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const recipientName = initialRecipient
    ? [initialRecipient.firstName, initialRecipient.lastName]
        .filter(Boolean)
        .join(" ")
    : null;

  // Fresh form every time the modal opens.
  useEffect(() => {
    if (open) {
      setTarget("ALL");
      setSubject("");
      setBody("");
      setError("");
      setSuccess(false);
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const reset = () => {
    setTarget("ALL");
    setSubject("");
    setBody("");
    setError("");
    setSuccess(false);
    setSending(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    setError("");
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    if (!body.trim()) {
      setError("Please write a message.");
      return;
    }
    setSending(true);
    try {
      await sendAnnouncement({
        subject: subject.trim(),
        body: body.trim(),
        ...(initialRecipient
          ? { target: "INDIVIDUAL", recipientEmployeeId: initialRecipient.id }
          : { target }),
      });
      setSuccess(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Failed to send.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <i className="ti ti-send" />
            </div>
            <div>
              <h3 className={styles.headerTitle}>Send Message</h3>
              <p className={styles.headerSub}>
                {recipientName
                  ? `Personal message to ${recipientName}`
                  : "Broadcast to everyone, or just HODs"}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {success ? (
            <div className={styles.successState}>
              <div className={styles.successIcon}>
                <i className="ti ti-circle-check" />
              </div>
              <p className={styles.successTitle}>Message sent!</p>
              <p className={styles.successSub}>
                {recipientName
                  ? `Your message has been delivered to ${recipientName}.`
                  : target === "ALL"
                    ? "Your message has been delivered to all active employees."
                    : "Your message has been delivered to every HOD."}
              </p>
              <div className={styles.successActions}>
                <button className={styles.sendAnotherBtn} onClick={reset}>
                  <i className="ti ti-plus" /> Send another
                </button>
                <button className={styles.doneBtn} onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className={styles.errorBox}>
                  <i className="ti ti-alert-circle" /> {error}
                </div>
              )}

              {/* To */}
              <div className={styles.field}>
                <label>To</label>
                {recipientName ? (
                  <div className={styles.toLocked}>
                    <i className="ti ti-user" /> {recipientName}
                  </div>
                ) : (
                  <div className={styles.toToggle}>
                    <button
                      className={`${styles.toBtn} ${target === "ALL" ? styles.toBtnActive : ""}`}
                      onClick={() => setTarget("ALL")}
                      type="button"
                    >
                      <i className="ti ti-speakerphone" /> All employees
                    </button>
                    <button
                      className={`${styles.toBtn} ${target === "HODS_ONLY" ? styles.toBtnActive : ""}`}
                      onClick={() => setTarget("HODS_ONLY")}
                      type="button"
                    >
                      <i className="ti ti-shield-star" /> All HODs
                    </button>
                  </div>
                )}
              </div>

              {/* Subject */}
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

              {/* Body */}
              <div className={styles.field}>
                <label>Message</label>
                <textarea
                  rows={5}
                  placeholder="Write your message here…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className={styles.footer}>
            <button
              className={styles.cancelBtn}
              onClick={handleClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={sending}
              type="button"
            >
              <i className="ti ti-send" />
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
