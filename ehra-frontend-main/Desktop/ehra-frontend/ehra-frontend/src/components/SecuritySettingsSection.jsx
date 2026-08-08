import { useEffect, useRef, useState } from "react";
import {
  getSecuritySettings,
  toggleTwoFactor,
  sendEmailVerification,
  sendBusinessEmailVerification,
} from "../api/phoneAuthApi";
import styles from "./SecuritySettingsSection.module.css";

export default function SecuritySettingsSection() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const emailCardRef = useRef(null);

  // ── Personal email (employee context — "enter it and verify right
  //    there", exactly like the business card below) ───────────────────
  const [personalEmailInput, setPersonalEmailInput] = useState("");
  const [personalSending, setPersonalSending] = useState(false);
  const [personalSent, setPersonalSent] = useState(false);
  const [personalError, setPersonalError] = useState("");
  const [personalDevLink, setPersonalDevLink] = useState(null);

  // ── Business email (employer context — "enter it and verify right
  //    there") ───────────────────────────────────────────────────────
  const [businessEmailInput, setBusinessEmailInput] = useState("");
  const [businessSending, setBusinessSending] = useState(false);
  const [businessSent, setBusinessSent] = useState(false);
  const [businessError, setBusinessError] = useState("");
  const [businessDevLink, setBusinessDevLink] = useState(null);

  // Confirmation modal state — toggling 2FA either direction requires the
  // current password (see TwoFactorToggleRequestDTO's rationale). A
  // SEPARATE "verify first" modal (no password field) appears instead
  // whenever the person tries to ENABLE 2FA without the required email
  // verified yet — see requiredEmailVerified below.
  const [confirming, setConfirming] = useState(null); // "enable" | "disable" | null
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [showVerifyFirst, setShowVerifyFirst] = useState(false);

  const loadSettings = () =>
    getSecuritySettings()
      .then((data) => {
        setSettings(data);
        setBusinessEmailInput(data?.businessEmail || "");
        setPersonalEmailInput(data?.email || "");
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

  // The single rule that governs both the subscription gate on the
  // backend and the 2FA toggle here: an employer needs their BUSINESS
  // email verified, OR their personal email already happens to be
  // verified (continuity rule); an employee (no business context) just
  // needs their personal email verified. Mirrors
  // EmailVerificationService#requireVerifiedEmailForSecurity exactly, so
  // what this button does and what the backend actually enforces never
  // drift apart.
  const requiredEmailVerified = settings?.hasBusinessContext
    ? Boolean(settings?.businessEmailVerified || settings?.emailVerified)
    : Boolean(settings?.emailVerified);

  const openConfirm = (action) => {
    if (action === "enable" && !requiredEmailVerified) {
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
      // gate independently (never trust the frontend's own check alone).
      // If it fires anyway (e.g. status changed in another tab), swap
      // straight to the "verify first" modal instead of a raw error.
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

  const handleVerifyPersonalEmail = async () => {
    setPersonalSending(true);
    setPersonalError("");
    setPersonalDevLink(null);
    try {
      const typed = personalEmailInput.trim().toLowerCase();
      const changed = typed && typed !== (settings?.email || "");
      const status = await sendEmailVerification(changed ? typed : undefined);
      setPersonalSent(true);
      if (status?.email) {
        setSettings((s) => ({ ...s, email: status.email }));
      }
      if (status?.developmentVerificationLink) {
        setPersonalDevLink(status.developmentVerificationLink);
      }
    } catch (err) {
      setPersonalError(
        err?.response?.data?.message ||
          "We couldn't send the verification email. Please try again.",
      );
    } finally {
      setPersonalSending(false);
    }
  };

  const handleVerifyBusinessEmail = async () => {
    setBusinessSending(true);
    setBusinessError("");
    setBusinessDevLink(null);
    try {
      const typed = businessEmailInput.trim().toLowerCase();
      const changed = typed && typed !== (settings?.businessEmail || "");
      const status = await sendBusinessEmailVerification(
        changed ? typed : undefined,
      );
      setBusinessSent(true);
      if (status?.email) {
        setSettings((s) => ({ ...s, businessEmail: status.email }));
      }
      if (status?.developmentVerificationLink) {
        setBusinessDevLink(status.developmentVerificationLink);
      }
    } catch (err) {
      setBusinessError(
        err?.response?.data?.message ||
          "We couldn't send the verification email. Please try again.",
      );
    } finally {
      setBusinessSending(false);
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

  const businessEmailChanged =
    businessEmailInput.trim().toLowerCase() !==
    (settings?.businessEmail || "").toLowerCase();

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
        {settings?.hasBusinessContext ? (
          <>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="ti ti-building" />
              </div>
              <div>
                <h3>Business email</h3>
                <p>
                  Required to purchase a subscription and to enable Two-Factor
                  Authentication. Personal email is managed separately from My
                  Profile and is never required.
                </p>
              </div>
            </div>

            {settings?.businessEmailVerified ? (
              <div className={styles.phoneRow}>
                <span className={styles.phoneNumber}>
                  {settings?.businessEmail}
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
                  placeholder="business@yourcompany.com"
                  value={businessEmailInput}
                  onChange={(e) => setBusinessEmailInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleVerifyBusinessEmail()
                  }
                />
                <button
                  type="button"
                  className={styles.verifyBtn}
                  onClick={handleVerifyBusinessEmail}
                  disabled={businessSending || !businessEmailInput.trim()}
                >
                  {businessSending
                    ? "Sending…"
                    : businessEmailChanged
                      ? "Save & Verify"
                      : businessSent
                        ? "Resend Verification Email"
                        : "Verify"}
                </button>
              </div>
            )}

            {!settings?.businessEmailVerified &&
              businessSent &&
              !businessError && (
                <p className={styles.emailHint}>
                  Check {settings?.businessEmail} for a verification link.
                </p>
              )}
            {businessError && (
              <div className={styles.errorBox}>
                <i className="ti ti-alert-circle" />
                <span>{businessError}</span>
              </div>
            )}
            {businessDevLink && (
              <div className={styles.devLinkBox}>
                <p>Development Mode — Verification Link</p>
                <a href={businessDevLink} target="_blank" rel="noreferrer">
                  Open Link
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <i className="ti ti-mail" />
              </div>
              <div>
                <h3>Personal email</h3>
                <p>
                  Required to enable Two-Factor Authentication. Set or change it
                  any time — no approval needed.
                </p>
              </div>
            </div>

            {settings?.emailVerified ? (
              <div className={styles.phoneRow}>
                <span className={styles.phoneNumber}>{settings?.email}</span>
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
                  value={personalEmailInput}
                  onChange={(e) => setPersonalEmailInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleVerifyPersonalEmail()
                  }
                />
                <button
                  type="button"
                  className={styles.verifyBtn}
                  onClick={handleVerifyPersonalEmail}
                  disabled={personalSending || !personalEmailInput.trim()}
                >
                  {personalSending
                    ? "Sending…"
                    : personalEmailInput.trim().toLowerCase() !==
                        (settings?.email || "").toLowerCase()
                      ? "Save & Verify"
                      : personalSent
                        ? "Resend Verification Email"
                        : "Verify"}
                </button>
              </div>
            )}

            {!settings?.emailVerified && personalSent && !personalError && (
              <p className={styles.emailHint}>
                Check {settings?.email} for a verification link.
              </p>
            )}
            {personalError && (
              <div className={styles.errorBox}>
                <i className="ti ti-alert-circle" />
                <span>{personalError}</span>
              </div>
            )}
            {personalDevLink && (
              <div className={styles.devLinkBox}>
                <p>Development Mode — Verification Link</p>
                <a href={personalDevLink} target="_blank" rel="noreferrer">
                  Open Link
                </a>
              </div>
            )}
          </>
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
            {settings?.phoneVerified && !requiredEmailVerified && (
              <p className={styles.toggleHint}>
                {settings?.hasBusinessContext
                  ? "A verified business email is required to enable this."
                  : "A verified email is required to enable this."}
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
          whenever the person tries to enable 2FA without the required
          email verified. No password field here at all: there is nothing
          to confirm yet. */}
      {showVerifyFirst && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowVerifyFirst(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>Verify your email first</h4>
            <p>
              {settings?.hasBusinessContext
                ? "Two-Factor Authentication needs a verified business email. Verify it below, then come back to enable 2FA."
                : "Two-Factor Authentication needs a verified email. Verify it below, then come back to enable 2FA."}
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
