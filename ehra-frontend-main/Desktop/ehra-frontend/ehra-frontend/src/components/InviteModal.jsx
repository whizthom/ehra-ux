import { useState } from "react";
import { generateInvitation, sendBulkInvitations } from "../api/invitationApi";
import styles from "./InviteEmployeeModal.module.css";

const TABS = [
  { key: "single", label: "One link", icon: "ti-link" },
  { key: "multi", label: "Reusable link", icon: "ti-link-plus" },
  { key: "email", label: "Invite by email", icon: "ti-mail-forward" },
];

/**
 * The shared engine behind InviteEmployeeModal and InviteCustomerModal -
 * one modal, three ways to invite, parameterized by `type` ("EMPLOYEE" or
 * "CUSTOMER" - see InvitationType on the backend):
 *
 *   - "One link": a single-use link, spent the moment one person
 *     registers with it (or accepts it while already logged in).
 *   - "Reusable link": the SAME link works for any number of people
 *     until revoked/expired - post it in a WhatsApp group, a notice
 *     board, wherever.
 *   - "Invite by email": paste a comma-separated list; the system
 *     creates an individually-bound single-use link PER address (more
 *     secure than sharing one link by email - a forwarded email can't be
 *     used to claim someone else's slot) and emails each person
 *     automatically.
 *
 * Whoever clicks the link: if they already have an Ehral account, they
 * log in and the invitation is accepted onto their existing account
 * (see acceptInvitation); otherwise they create a brand-new account and
 * are registered straight onto it (see registerInvitedEmployee /
 * registerInvitedCustomer) - either way they end up connected to this
 * business the moment they finish.
 */
export default function InviteModal({
  open,
  onClose,
  companyName,
  type = "EMPLOYEE",
  title,
  description,
}) {
  const [tab, setTab] = useState("single");
  const isCustomer = type === "CUSTOMER";

  // Link tabs (single / multi) share this state - only one of the two
  // is ever generated at a time per tab switch, each tab remembers its
  // own last-generated link independently.
  const [links, setLinks] = useState({ single: "", multi: "" });
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Bulk-email tab
  const [emailsInput, setEmailsInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { sent, skipped, batchId }
  const [bulkError, setBulkError] = useState("");

  if (!open) return null;

  const currentLink = tab === "multi" ? links.multi : links.single;
  const noun = isCustomer ? "customer" : "employee";

  const handleGenerate = async () => {
    setGenerating(true);
    setLinkError("");
    try {
      const data = await generateInvitation(tab === "multi", type);
      setLinks((prev) => ({ ...prev, [tab]: data.invitationLink }));
      setCopied(false);
    } catch {
      setLinkError("Unable to generate a link right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendBulk = async () => {
    setSending(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const result = await sendBulkInvitations(emailsInput, type);
      setBulkResult(result);
      if (result?.sent?.length) {
        setEmailsInput("");
      }
    } catch (err) {
      setBulkError(
        err?.response?.data?.message ||
          "Unable to send invitations right now. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setBulkResult(null);
    setBulkError("");
    setLinkError("");
    onClose();
  };

  const waMessage = isCustomer
    ? `${companyName} has invited you to connect with them as a customer on Ehral.\n\n${currentLink}`
    : `You've been invited to join ${companyName} on Ehral.\n\n${currentLink}`;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            {title || (isCustomer ? "Invite a customer" : "Invite employees")}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close"
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={styles.body}>
          {description && <p className={styles.desc}>{description}</p>}

          <div className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                onClick={() => setTab(t.key)}
              >
                <i className={`ti ${t.icon}`} />
                {t.label}
              </button>
            ))}
          </div>

          {(tab === "single" || tab === "multi") && (
            <div className={styles.tabBody}>
              <p className={styles.desc}>
                {tab === "single"
                  ? `A one-time link - it stops working the moment one ${noun} registers with it (or accepts it while already logged in). Generate a fresh one for each new ${noun}.`
                  : `A reusable link - the same link works for any number of ${
                      isCustomer ? "customers" : "people"
                    }, so you can post it in a group chat, on a receipt, or your storefront. Generate once, share as many times as you like.`}
              </p>

              {currentLink ? (
                <>
                  <div className={styles.linkRow}>
                    <i
                      className="ti ti-link"
                      style={{ color: "var(--accent)" }}
                    />
                    <input
                      className={styles.linkInput}
                      readOnly
                      value={currentLink}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className={styles.linkActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.copyBtn}`}
                      onClick={handleCopy}
                    >
                      <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`${styles.actionBtn} ${styles.waBtn}`}
                    >
                      <i className="ti ti-brand-whatsapp" />
                      Share
                    </a>
                    <button
                      type="button"
                      className={styles.regenBtn}
                      onClick={handleGenerate}
                      disabled={generating}
                    >
                      {generating ? "Generating…" : "Generate new"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating
                    ? "Generating…"
                    : tab === "single"
                      ? "Generate link"
                      : "Generate reusable link"}
                </button>
              )}

              {linkError && (
                <div className={styles.errorBox}>
                  <i className="ti ti-alert-circle" />
                  <span>{linkError}</span>
                </div>
              )}
            </div>
          )}

          {tab === "email" && (
            <div className={styles.tabBody}>
              <p className={styles.desc}>
                Paste the email addresses of everyone you want to invite,
                separated by commas. Each person gets their own unique, one-time
                link sent straight to their inbox.
              </p>

              <textarea
                className={styles.emailsTextarea}
                placeholder="jane@example.com, tunde@example.com, amaka@example.com"
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                rows={4}
              />

              <button
                type="button"
                className={styles.generateBtn}
                onClick={handleSendBulk}
                disabled={sending || !emailsInput.trim()}
              >
                {sending ? "Sending…" : "Send invitations"}
              </button>

              {bulkError && (
                <div className={styles.errorBox}>
                  <i className="ti ti-alert-circle" />
                  <span>{bulkError}</span>
                </div>
              )}

              {bulkResult && (
                <div className={styles.bulkResult}>
                  {bulkResult.sent?.length > 0 && (
                    <p className={styles.bulkSentNote}>
                      <i className="ti ti-circle-check" /> Sent to{" "}
                      {bulkResult.sent.length}{" "}
                      {bulkResult.sent.length === 1 ? "address" : "addresses"}:{" "}
                      {bulkResult.sent.join(", ")}
                    </p>
                  )}
                  {bulkResult.skipped?.length > 0 && (
                    <div className={styles.skippedList}>
                      <p className={styles.skippedHeading}>
                        Skipped ({bulkResult.skipped.length}):
                      </p>
                      <ul>
                        {bulkResult.skipped.map((s) => (
                          <li key={s.email}>
                            <strong>{s.email}</strong> - {s.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
