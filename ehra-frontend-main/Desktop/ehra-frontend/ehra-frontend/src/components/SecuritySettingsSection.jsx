import { useEffect, useRef, useState } from "react";
import {
  getSecuritySettings,
  toggleTwoFactor,
  sendEmailVerification,
} from "../api/phoneAuthApi";
import styles from "./SecuritySettingsSection.module.css";

export default function SecuritySettingsSection() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const emailCardRef = useRef(null);

  // ── Verified email — ONE shared email per Identity, identical
  //    regardless of employer/employee context (see
  //    EmailVerificationService's class doc). "Enter it and verify right
  //    there" — same pattern for everyone. ────────────────────────────
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [devLink, setDevLink] = useState(null);

  // Confirmation modal state — toggling 2FA either direction requires the
  // current password. A SEPARATE "verify first" modal (no password
  // field) appears instead whenever the person tries to ENABLE 2FA
  // without a verified email yet.
  const [confirming, setConfirming] = useState(null); // "enable" | "disable" | null
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [showVerifyFirst, setShowVerifyFirst] = useState(false);

  const loadSettings = () =>
    getSecuritySettings()
      .then((data) => {
        setSettings(data);
        setEmailInput(data?.email || "");
      })
      .catch(() => setError("Couldn't load your security settings."));

  useEffect(() => {
    let cancelled = false;
    loadSettings().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConfirm = (action) => {
    if (action === "enable" && !settings?.emailVerified) {
      setShowVerifyFirst(true);
      return;
    }
    setConfirming(action);
    setPassword("");
    setConfirmError("");
  };

  const handleConfirm = async () => {
    if (!password) {
      setConfirmError("Enter your password to continue.");
      return;
    }
    setSaving(true);
    setConfirmError("");
    try {
      const updated = await toggleTwoFactor(confirming === "enable", password);
      setSettings(updated);
      setConfirming(null);
    } catch (err) {
      const msg = err?.response?.data?.message || "";
      // Defense-in-depth: the backend enforces the same email-verified
      // gate independently. If it ever fires anyway (e.g. status changed
      // in another tab), swap to the "verify first" modal instead of a
      // raw error.
      if (err?.response?.status === 403) {
        setConfirming(null);
        setShowVerifyFirst(true);
        return;
      }
      setConfirmError(msg || "Incorrect password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const jumpToEmailCard = () => {
    setShowVerifyFirst(false);
    emailCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleVerifyEmail = async () => {
    setSending(true);
    setEmailError("");
    setDevLink(null);
    try {
      const typed = emailInput.trim().toLowerCase();
      const changed = typed && typed !== (settings?.email || "");
      const status = await sendEmailVerification(changed ? typed : undefined);
      setSent(true);
      if (status?.email) {
        setSettings((s) => ({ ...s, email: status.email }));
      }
      if (status?.developmentVerificationLink) {
        setDevLink(status.developmentVerificationLink);
      }
    } catch (err) {
      setEmailError(
        err?.response?.data?.message ||
          "We couldn't send the verification email. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <p className={styles.loading}>Loading your security settings…</p>;
  }

  if (error) {
    return (
      <div className={styles.errorBox}>
        <i className="ti ti-alert-circle" />
        <span>{error}</span>
      </div>
    );
  }

  const emailChanged =
    emailInput.trim().toLowerCase() !== (settings?.email || "").toLowerCase();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <i className="ti ti-device-mobile" />
          </div>
          <div>
            <h3>Verified phone number</h3>
            <p>This is your Ehra identity and where 2FA codes are sent.</p>
          </div>
        </div>
        <div className={styles.phoneRow}>
          <span className={styles.phoneNumber}>
            {settings?.maskedPhoneNumber || "Not set"}
          </span>
          {settings?.phoneVerified && (
            <span className={styles.verifiedBadge}>
              <i className="ti ti-rosette-discount-check" /> Verified
            </span>
          )}
        </div>
      </div>

      <div className={styles.card} ref={emailCardRef}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <i className="ti ti-mail" />
          </div>
          <div>
            <h3>Verified email</h3>
            <p>
              Required to enable Two-Factor Authentication and purchase a
              subscription. This is the ONE verified email for your account —
              it's shared across every business you own and any workplace you're
              an employee at, so you only ever verify once. Your personal
              contact email (My Profile) and any business's own contact email
              can still be changed freely any time — that never affects what's
              verified here.
            </p>
          </div>
        </div>

        {settings?.emailVerified ? (
          <div className={styles.phoneRow}>
            <span className={styles.phoneNumber}>
              {settings?.verifiedEmail}
            </span>
            <span className={styles.verifiedBadge}>
              <i className="ti ti-rosette-discount-check" /> Verified
            </span>
          </div>
        ) : (
          <div className={styles.emailEditRow}>
            <input
              type="email"
              className={styles.emailInput}
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyEmail()}
            />
            <button
              type="button"
              className={styles.verifyBtn}
              onClick={handleVerifyEmail}
              disabled={sending || !emailInput.trim()}
            >
              {sending
                ? "Sending…"
                : emailChanged
                  ? "Save & Verify"
                  : sent
                    ? "Resend Verification Email"
                    : "Verify"}
            </button>
          </div>
        )}

        {!settings?.emailVerified && sent && !emailError && (
          <p className={styles.emailHint}>
            Check {settings?.email} for a verification link.
          </p>
        )}
        {emailError && (
          <div className={styles.errorBox}>
            <i className="ti ti-alert-circle" />
            <span>{emailError}</span>
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
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <i className="ti ti-shield-lock" />
          </div>
          <div>
            <h3>Two-Factor Authentication</h3>
            <p>
              When enabled, signing in requires your password AND a code sent to
              your verified phone.
            </p>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>
              {settings?.twoFactorEnabled ? "Enabled" : "Disabled"}
            </p>
            {!settings?.phoneVerified && (
              <p className={styles.toggleHint}>
                A verified phone number is required to enable this.
              </p>
            )}
            {settings?.phoneVerified && !settings?.emailVerified && (
              <p className={styles.toggleHint}>
                A verified email is required to enable this.
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings?.twoFactorEnabled}
            disabled={!settings?.phoneVerified}
            className={`${styles.switch} ${settings?.twoFactorEnabled ? styles.switchOn : ""}`}
            onClick={() =>
              openConfirm(settings?.twoFactorEnabled ? "disable" : "enable")
            }
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
      </div>

      {/* "Verify your email first" — shown INSTEAD OF the password modal
          whenever the person tries to enable 2FA without a verified
          email. No password field here at all: there is nothing to
          confirm yet. */}
      {showVerifyFirst && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowVerifyFirst(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>Verify your email first</h4>
            <p>
              Two-Factor Authentication needs a verified email. Verify it below,
              then come back to enable 2FA.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowVerifyFirst(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={jumpToEmailCard}
              >
                Go to email verification
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setConfirming(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>
              {confirming === "enable"
                ? "Enable Two-Factor Authentication?"
                : "Disable Two-Factor Authentication?"}
            </h4>
            <p>Confirm your password to continue.</p>

            {confirmError && (
              <div className={styles.errorBox}>
                <i className="ti ti-alert-circle" />
                <span>{confirmError}</span>
              </div>
            )}

            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className={styles.modalInput}
              autoFocus
            />

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirming(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : confirming === "enable"
                    ? "Enable"
                    : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
