import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendPhoneOtp, confirmPhoneOtp, resetRecaptcha } from "../firebase";
import { verifyTwoFactorLogin } from "../api/phoneAuthApi";
import styles from "./Login.module.css";
import phoneStyles from "./PhoneAuth.module.css";

// A believable, static glimpse of what's happening inside a live workspace —
// the same kind of event this app already surfaces as real notifications.
// Doubled below so the marquee loops seamlessly.
const TICKER_ITEMS = [
  {
    icon: "ti-fingerprint",
    text: "Amaka O. clocked in",
    meta: "Engineering · 9:02 AM",
  },
  {
    icon: "ti-calendar-check",
    text: "Leave approved for Tunde B.",
    meta: "Operations · Just now",
  },
  { icon: "ti-user-plus", text: "New hire onboarded", meta: "Design · Today" },
  {
    icon: "ti-cash-banknote",
    text: "Payroll run completed",
    meta: "42 employees · 2h ago",
  },
  {
    icon: "ti-user-check",
    text: "Profile update approved",
    meta: "HR · 4h ago",
  },
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.tickerTrack}>
        {items.map((item, i) => (
          <div className={styles.tickerCard} key={i}>
            <span className={styles.tickerIcon}>
              <i className={`ti ${item.icon}`} />
            </span>
            <span className={styles.tickerBody}>
              <span className={styles.tickerText}>{item.text}</span>
              <span className={styles.tickerMeta}>{item.meta}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { login, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // "identifier" accepts EITHER an email or a phone number — Identity
  // supports dual-identifier login (see LoginRequestDTO).
  const [form, setForm] = useState({
    identifier: location.state?.phone || "",
    password: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // 2FA step — null until /auth/login comes back with requiresTwoFactor.
  const [twoFactor, setTwoFactor] = useState(null); // { pendingToken, phoneNumber }
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (twoFactor) otpInputRef.current?.focus();
  }, [twoFactor]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const routeAfterLogin = (data) => {
    // Someone else may have sent an invite link while this person was
    // logged out — InvitationLanding stashes the token here before
    // bouncing them to /login. Finish that trip now that they're signed
    // in, instead of dropping them on a generic dashboard.
    const pendingInvite = sessionStorage.getItem("ehra_pending_invite");
    if (pendingInvite) {
      sessionStorage.removeItem("ehra_pending_invite");
      navigate(`/invite/${pendingInvite}`);
      return;
    }

    // An Identity holding more than one membership hasn't picked a
    // workspace for this session yet — show the switcher instead of
    // guessing which dashboard to land on.
    if (data.needsContextSelection) {
      navigate("/select-workspace");
      return;
    }

    navigate(data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard");
  };

  const handleSubmit = async () => {
    setError("");
    setNotice("");
    if (!form.identifier || !form.password) {
      setError("Please enter your email/phone and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await login(form.identifier, form.password);

      if (data.requiresTwoFactor) {
        // Kick off the OTP challenge immediately so the person doesn't
        // have to press an extra "send code" button on top of "sign in".
        const result = await sendPhoneOtp(data.phoneNumber);
        setConfirmationResult(result);
        setTwoFactor({
          pendingToken: data.twoFactorToken,
          phoneNumber: data.phoneNumber,
        });
        setResendIn(30);
        return;
      }

      routeAfterLogin(data);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Invalid email/phone or password. Please try again.";
      setError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || !twoFactor) return;
    setError("");
    setLoading(true);
    try {
      resetRecaptcha();
      const result = await sendPhoneOtp(twoFactor.phoneNumber);
      setConfirmationResult(result);
      setOtp("");
      setResendIn(30);
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setLoading(true);
    try {
      const idToken = await confirmPhoneOtp(confirmationResult, otp.trim());
      const data = await verifyTwoFactorLogin(twoFactor.pendingToken, idToken);
      await refreshSession?.();
      routeAfterLogin(data);
    } catch (err) {
      setError(err?.response?.data?.message || friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      {/* ── Left panel — brand + live product moment ── */}
      <div className={styles.left}>
        <div className={styles.dotGrid} aria-hidden="true" />

        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <div className={styles.leftBody}>
          <span className={styles.eyebrow}>Workforce operating system</span>
          <h1 className={styles.headline}>
            Run your whole workforce from one screen.
          </h1>
          <p className={styles.desc}>
            Attendance, leave, payroll and performance — synced in real time,
            not spreadsheets.
          </p>

          <div className={styles.tickerBlock}>
            <span className={styles.tickerCaption}>
              A normal Tuesday inside Ehra
            </span>
            <Ticker />
          </div>
        </div>

        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right panel — sign in ── */}
      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoIcon}>💼</div>
            <span className={styles.mobileLogoText}>Ehra</span>
          </div>

          {!twoFactor ? (
            <>
              <div className={styles.rightHeader}>
                <h2 className={styles.h1}>
                  Welcome back
                  <span className={styles.h1Accent} aria-hidden="true" />
                </h2>
                <p className={styles.subtitle}>
                  Sign in to keep things running.
                </p>
              </div>

              {notice && (
                <div className={styles.errorBox} role="status">
                  <i className="ti ti-info-circle" />
                  <span>{notice}</span>
                </div>
              )}
              {error && (
                <div className={styles.errorBox} role="alert">
                  <i className="ti ti-alert-circle" />
                  <span>{error}</span>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="identifier">
                  Email or phone number
                </label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-mail ${styles.prefix}`} />
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    placeholder="you@company.com or +234 800 000 0000"
                    value={form.identifier}
                    onChange={handleChange}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      document.getElementById("password").focus()
                    }
                    className={styles.input}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="password">
                    Password
                  </label>
                  <a
                    className={styles.forgot}
                    onClick={() => navigate("/forgot-password")}
                  >
                    Forgot password?
                  </a>
                </div>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    id="password"
                    name="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className={styles.input}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <i className={`ti ${showPw ? "ti-eye-off" : "ti-eye"}`} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>

              <p className={styles.registerLink}>
                New to Ehra?{" "}
                <a href="/" className={styles.registerLinkAnchor}>
                  Create your workspace →
                </a>
              </p>
            </>
          ) : (
            <>
              <div className={styles.rightHeader}>
                <h2 className={styles.h1}>
                  Two-step verification
                  <span className={styles.h1Accent} aria-hidden="true" />
                </h2>
                <p className={styles.subtitle}>
                  Enter the code we just sent to confirm it's you.
                </p>
              </div>

              {error && (
                <div className={styles.errorBox} role="alert">
                  <i className="ti ti-alert-circle" />
                  <span>{error}</span>
                </div>
              )}

              <div className={phoneStyles.otpHeadline}>
                <p>
                  Code sent to <strong>{twoFactor.phoneNumber}</strong>
                </p>
                <button
                  type="button"
                  className={phoneStyles.changeNumberBtn}
                  onClick={() => {
                    setTwoFactor(null);
                    setOtp("");
                    setError("");
                  }}
                >
                  Cancel
                </button>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Verification code</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-shield-check ${styles.prefix}`} />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleVerifyTwoFactor()
                    }
                    className={`${styles.input} ${phoneStyles.otpInput}`}
                  />
                </div>
              </div>

              <button
                type="button"
                className={phoneStyles.resendBtn}
                onClick={handleResendOtp}
                disabled={resendIn > 0 || loading}
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleVerifyTwoFactor}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <span>Verify & sign in</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (
    code.includes("invalid-verification-code") ||
    code.includes("code-expired")
  ) {
    return "That code is incorrect or has expired. Please try again.";
  }
  if (code.includes("network-request-failed")) {
    return "Network error — please check your connection and try again.";
  }
  return err?.message || "Something went wrong. Please try again.";
}
