import { useState, useEffect } from "react";
import { sendAnnouncement } from "../api/notificationApi";
import styles from "./QuickSendMessageModal.module.css";

export default function QuickSendMessageModal({
  open,
  onClose,
  employees = [],
  initialRecipientId = null, // when set, opens pre-targeted at this employee
}) {
  const [recipientId, setRecipientId] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fresh form every time the modal opens — and if it was opened from a
  // specific employee's "message" shortcut (e.g. Workforce grid card),
  // pre-select them instead of defaulting to "all".
  useEffect(() => {
    if (open) {
      setRecipientId(
        initialRecipientId != null ? String(initialRecipientId) : "all",
      );
      setSubject("");
      setBody("");
      setError("");
      setSuccess(false);
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRecipientId]);

  if (!open) return null;

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");

  const reset = () => {
    setRecipientId("all");
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
        recipientEmployeeId:
          recipientId === "all" ? undefined : Number(recipientId),
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
                Broadcast or send to an individual
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
                {recipientId === "all"
                  ? "Your message has been delivered to all active employees."
                  : `Your message has been delivered to ${
                      activeEmployees.find(
                        (e) => String(e.id) === String(recipientId),
                      )
                        ? [
                            activeEmployees.find(
                              (e) => String(e.id) === String(recipientId),
                            ).firstName,
                            activeEmployees.find(
                              (e) => String(e.id) === String(recipientId),
                            ).lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : "the employee"
                    }.`}
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
                <div className={styles.toToggle}>
                  <button
                    className={`${styles.toBtn} ${recipientId === "all" ? styles.toBtnActive : ""}`}
                    onClick={() => setRecipientId("all")}
                    type="button"
                  >
                    <i className="ti ti-speakerphone" /> All employees
                  </button>
                  <button
                    className={`${styles.toBtn} ${recipientId !== "all" ? styles.toBtnActive : ""}`}
                    onClick={() => setRecipientId(activeEmployees[0]?.id ?? "")}
                    type="button"
                  >
                    <i className="ti ti-user" /> Specific person
                  </button>
                </div>
                {recipientId !== "all" && (
                  <select
                    className={styles.selectEmployee}
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                  >
                    {activeEmployees.length === 0 ? (
                      <option value="">No active employees</option>
                    ) : (
                      activeEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {[e.firstName, e.lastName].filter(Boolean).join(" ")}{" "}
                          — {e.email}
                        </option>
                      ))
                    )}
                  </select>
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
