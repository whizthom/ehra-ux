import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmailToken, sendEmailVerification } from "../api/phoneAuthApi";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import styles from "./VerifyEmail.module.css";

// Landed on directly from the link in the verification email:
// https://ehral.com/verify-email?token=xxxxxxxx (see EmailTemplates on
// the backend). Fires the redeem call automatically on mount — no
// "press Verify" button needed, matching the "Verify Page" spec.
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const token = searchParams.get("token");

  // "loading" -> "success" | "expired" | "error"
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await verifyEmailToken(token);
        if (cancelled) return;
        setStatus("success");
        // Give the success state a moment to register before bouncing
        // onward — a person who just clicked an email link benefits from
        // seeing confirmation, not an instant redirect.
        setTimeout(() => {
          if (!cancelled) {
            navigate(isAuthenticated ? "/dashboard" : "/login", {
              state: isAuthenticated
                ? { emailJustVerified: true }
                : { message: "Your email is verified. Please log in." },
            });
          }
        }, 2200);
      } catch (err) {
        if (cancelled) return;
        const data = err.response?.data;
        const expired = (data?.message || "").toLowerCase().includes("expired");
        setStatus(expired ? "expired" : "error");
        setMessage(
          data?.message ||
            "We couldn't verify this link. It may be invalid or already used.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    try {
      await sendEmailVerification();
      setResent(true);
    } catch {
      setMessage(
        "We couldn't send a new link right now. Please try again from Settings > Security.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <Logo variant="horizontal" size={64} />
        </div>

        {status === "loading" && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconLoading}`}>
              <div className={styles.spinner} />
            </div>
            <h1 className={styles.title}>Verifying your email…</h1>
            <p className={styles.desc}>This will only take a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
              <i className="ti ti-circle-check" />
            </div>
            <h1 className={styles.title}>🎉 Email Verified!</h1>
            <p className={styles.desc}>
              Your email has been successfully verified. It's now the one
              verified email for your account, shared across every business you
              own and any workplace you're an employee at — ready for
              subscriptions, Two-Factor Authentication, and future account
              recovery.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() =>
                  navigate(isAuthenticated ? "/dashboard" : "/login")
                }
              >
                Continue
              </button>
            </div>
          </>
        )}

        {(status === "expired" || status === "error") && (
          <>
            <div className={`${styles.iconWrap} ${styles.iconError}`}>
              <i className="ti ti-alert-circle" />
            </div>
            <h1 className={styles.title}>
              {status === "expired"
                ? "Verification link expired"
                : "Verification failed"}
            </h1>
            <p className={styles.desc}>{message}</p>

            {resent ? (
              <p className={styles.desc}>
                A new verification link is on its way — check your inbox.
              </p>
            ) : (
              <div className={styles.actions}>
                {isAuthenticated && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? "Sending…" : "Resend Verification Email"}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() =>
                    navigate(isAuthenticated ? "/dashboard" : "/login")
                  }
                >
                  {isAuthenticated ? "Back to Dashboard" : "Back to Login"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
