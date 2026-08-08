import { useEffect, useState } from "react";
import {
  getBusinessEmailStatus,
  sendBusinessEmailVerification,
} from "../api/phoneAuthApi";
import styles from "./VerifyEmailToUpgradeModal.module.css";

// Shown INSTEAD OF the Paystack popup whenever checkout/initialize comes
// back 403 (EmailNotVerifiedException — see
// EmailVerificationService#requireVerifiedEmailForSecurity). Starter
// never reaches this, since it never calls checkout at all; every paid
// plan does.
//
// "If verified, it leads them straight to processing" — this modal
// polls business-email status every few seconds while open, so the
// moment the person clicks the link in their inbox (in another tab), it
// auto-detects that and calls onVerified() itself — no manual "I've
// verified, continue" click required, though that button is also there
// as a fallback for anyone who'd rather trigger it themselves.
export default function VerifyEmailToUpgradeModal({ onVerified, onClose }) {
  const [emailInput, setEmailInput] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBusinessEmailStatus()
      .then((status) => {
        if (cancelled) return;
        setCurrentEmail(status?.email || "");
        setEmailInput(status?.email || "");
        if (status?.emailVerified) onVerified();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-continue the moment the business email becomes verified —
  // catches the person clicking the emailed link in another tab without
  // making them come back and click anything here.
  useEffect(() => {
    if (!sent) return;
    const interval = setInterval(async () => {
      try {
        const status = await getBusinessEmailStatus();
        if (status?.emailVerified) {
          clearInterval(interval);
          onVerified();
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  const handleSendVerification = async () => {
    setSending(true);
    setError("");
    setDevLink(null);
    try {
      const typed = emailInput.trim().toLowerCase();
      const changed = typed && typed !== currentEmail;
      const status = await sendBusinessEmailVerification(
        changed ? typed : undefined,
      );
      setSent(true);
      if (status?.email) setCurrentEmail(status.email);
      if (status?.developmentVerificationLink) {
        setDevLink(status.developmentVerificationLink);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "We couldn't send the verification email. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setError("");
    try {
      const status = await getBusinessEmailStatus();
      if (status?.emailVerified) {
        onVerified();
      } else {
        setError(
          "Not verified yet — check your inbox and click the link, then try again.",
        );
      }
    } catch {
      setError("Couldn't check verification status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          <i className="ti ti-mail-check" />
        </div>
        <h2 className={styles.title}>Verify your business email to continue</h2>
        <p className={styles.desc}>
          Subscriptions require a verified business email. Confirm the address
          below, and we'll take you straight to payment the moment it's
          verified.
        </p>

        <div className={styles.emailEditRow}>
          <input
            type="email"
            className={styles.emailInput}
            placeholder="business@yourcompany.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendVerification()}
          />
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSendVerification}
            disabled={sending || !emailInput.trim()}
          >
            {sending
              ? "Sending…"
              : emailInput.trim().toLowerCase() !== currentEmail.toLowerCase()
                ? "Save & Verify"
                : sent
                  ? "Resend"
                  : "Verify"}
          </button>
        </div>

        {sent && !error && (
          <p className={styles.sentNote}>
            <i className="ti ti-clock" /> Check {currentEmail} for a
            verification link — this will continue automatically once you click
            it.
          </p>
        )}
        {error && (
          <div className={styles.errorBox}>
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}
        {devLink && (
          <div className={styles.devLinkBox}>
            <p>Development Mode — Verification Link</p>
            <a href={devLink} target="_blank" rel="noreferrer">
              Open Link
            </a>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          {sent && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleCheckNow}
              disabled={checking}
            >
              {checking ? "Checking…" : "I've verified — Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
