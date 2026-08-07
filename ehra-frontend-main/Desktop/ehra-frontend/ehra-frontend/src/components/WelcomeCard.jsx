import { useEffect, useState } from "react";
import { getEmailStatus, sendEmailVerification } from "../api/phoneAuthApi";
import styles from "./WelcomeCard.module.css";

const sessionKey = (identityId) => `ehra:welcomeCard:seen:${identityId}`;

/**
 * "First Login Experience" — shown once, directly on the Dashboard the
 * person lands on right after STEP 5 (Account Creation). Mount
 * unconditionally near the top of Dashboard; renders nothing once
 * dismissed or once it's already been shown this browser session (a
 * refresh loses the router `state` this reads from, so sessionStorage is
 * what actually prevents it reappearing on every reload).
 *
 * `justRegistered` comes from Register.jsx's navigate(..., { state }) —
 * this card ONLY ever appears immediately after that specific redirect,
 * never on an ordinary login.
 */
export default function WelcomeCard({
  identityId,
  justRegistered,
  firstName,
  email,
}) {
  const [dismissed, setDismissed] = useState(true);
  const [devLink, setDevLink] = useState(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!justRegistered || !identityId) return;
    if (window.sessionStorage.getItem(sessionKey(identityId))) return;

    setDismissed(false);
    window.sessionStorage.setItem(sessionKey(identityId), "1");

    // Auto-reveal the dev verification link the same way DevOtpCard
    // auto-reveals the mock OTP — no click needed. ALWAYS null against a
    // real provider; see EmailVerificationService#getStatus.
    getEmailStatus()
      .then((status) => {
        if (status?.developmentVerificationLink) {
          setDevLink(status.developmentVerificationLink);
        }
      })
      .catch(() => {});
  }, [justRegistered, identityId]);

  const handleResend = async () => {
    setResending(true);
    try {
      const status = await sendEmailVerification();
      setResent(true);
      if (status?.developmentVerificationLink) {
        setDevLink(status.developmentVerificationLink);
      }
    } catch {
      // Non-critical — the person can always retry from Settings > Security.
    } finally {
      setResending(false);
    }
  };

  if (dismissed) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card} role="dialog" aria-modal="true">
        <div className={styles.emoji}>🎉</div>
        <h2 className={styles.title}>
          Welcome to Ehra{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p className={styles.desc}>
          Your workspace has been created successfully.
        </p>

        {email && (
          <p className={styles.desc}>
            We've sent a verification email to <strong>{email}</strong>. You can
            continue using Ehra while you verify your email.
          </p>
        )}

        {devLink && (
          <div className={styles.devBox} role="status">
            <div className={styles.devLabel}>🧪 Development Mode</div>
            <a
              href={devLink}
              target="_blank"
              rel="noreferrer"
              className={styles.devLink}
            >
              Open verification link
            </a>
          </div>
        )}

        {resent && !devLink && (
          <p className={styles.resentNote}>
            A new verification link is on its way.
          </p>
        )}

        <div className={styles.actions}>
          {email && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend Email"}
            </button>
          )}
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setDismissed(true)}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
