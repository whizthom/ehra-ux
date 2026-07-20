import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { sendPhoneOtp, confirmPhoneOtp, resetRecaptcha } from "../firebase";
import { checkPhone, registerWithPhone } from "../api/phoneAuthApi";
import styles from "./Register.module.css";
import phoneStyles from "./PhoneAuth.module.css";

// Draft is kept in sessionStorage (not localStorage) so it survives a trip
// between steps or an accidental refresh, but doesn't linger forever on a
// shared machine — it's cleared the moment registration fully completes.
const DRAFT_KEY = "ehra_signup_phone_draft";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(partial) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(partial));
  } catch {
    // sessionStorage unavailable (private mode etc.) — fail silently.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const RESEND_COOLDOWN_SECONDS = 30;

export default function Register() {
  const navigate = useNavigate();

  // step: "phone" -> "otp" -> "business"
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState(() => loadDraft()?.phone || "");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [idToken, setIdToken] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // ── STEP 1 -> 2: send the OTP ──────────────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    if (!phone || !isValidPhoneNumber(phone)) {
      setError("Enter a valid phone number, including country code.");
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneOtp(phone);
      setConfirmationResult(result);
      saveDraft({ phone });
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      resetRecaptcha();
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    setError("");
    setLoading(true);
    try {
      resetRecaptcha();
      const result = await sendPhoneOtp(phone);
      setConfirmationResult(result);
      setOtp("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2 -> 3: verify the OTP, then check if this phone already has
  //    an account (STEP 6-7 of the spec) ─────────────────────────────────
  const handleVerifyOtp = async () => {
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }

    setLoading(true);
    try {
      const token = await confirmPhoneOtp(confirmationResult, otp.trim());
      setIdToken(token);

      const check = await checkPhone(token);
      if (check.exists) {
        // STEP 7: never continue into registration for a phone that
        // already has an account — send them to log in instead.
        clearDraft();
        navigate("/login", {
          state: {
            message:
              "This phone number already has an Ehra account. Please log in.",
            phone,
          },
        });
        return;
      }

      setStep("business");
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 3: business name + password, create the account ──────────────
  const handleCreateAccount = async () => {
    setError("");
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await registerWithPhone(
        idToken,
        businessName.trim(),
        password,
      );
      clearDraft();
      // STEP 9-10: auto-logged in — redirect exactly as a normal login
      // would, straight into the dashboard (never a needsContextSelection
      // case for a brand-new business, but handled the same way for
      // consistency with every other entry point).
      navigate(data.needsContextSelection ? "/select-workspace" : "/dashboard");
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409) {
        // STEP 7 defense in depth — the /register call itself re-checks.
        navigate("/login", {
          state: { message: data?.message, phone },
        });
        return;
      }
      if (data?.errors) {
        setError(Object.values(data.errors)[0]);
      } else {
        setError(data?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = { phone: 1, otp: 1, business: 2 }[step];
  const progressPct = { phone: 15, otp: 45, business: 80 }[step];

  return (
    <div className={styles.page}>
      {/* ── Left ── */}
      <div className={styles.left}>
        <div className={styles.dotGrid} aria-hidden="true" />

        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <div className={styles.leftBody}>
          <span className={styles.eyebrow}>Get started</span>
          <h1 className={styles.headline}>Set up your workspace in minutes</h1>
          <p className={styles.desc}>
            Your phone number is your Ehra identity — verify it once, and you're
            in.
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepLine} />
              <div
                className={`${styles.stepDot} ${stepIndex >= 1 ? styles.dotActive : styles.dotPending}`}
              >
                {step === "business" ? <i className="ti ti-check" /> : 1}
              </div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Verify your phone number</p>
                <p className={styles.stepSub}>We'll text you a one-time code</p>
              </div>
            </div>
            <div className={styles.step}>
              <div
                className={`${styles.stepDot} ${stepIndex >= 2 ? styles.dotActive : styles.dotPending}`}
              >
                2
              </div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Name your business</p>
                <p className={styles.stepSub}>Business name & password</p>
              </div>
            </div>
          </div>
        </div>

        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right ── */}
      <div className={styles.right}>
        <div className={styles.rightHeader}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className={styles.headerRow}>
            <span className={styles.stepTitle}>
              {step === "phone" && "Verify your phone number"}
              {step === "otp" && "Enter the verification code"}
              {step === "business" && "Name your business"}
            </span>
            <span className={styles.stepCount}>Step {stepIndex} of 2</span>
          </div>
        </div>

        <div className={styles.formBody}>
          {error && (
            <div className={styles.errorBox} role="alert">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          {/* ══ STEP 1: PHONE ══ */}
          {step === "phone" && (
            <>
              <div className={styles.field}>
                <label>Phone number</label>
                <div className={phoneStyles.phoneInputWrap}>
                  <PhoneInput
                    international
                    defaultCountry="NG"
                    countryCallingCodeEditable={false}
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={setPhone}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className={phoneStyles.phoneInput}
                  />
                </div>
                <span className={phoneStyles.hint}>
                  This becomes your permanent Ehra login identity.
                </span>
              </div>

              <div className={styles.infoBox}>
                <i className="ti ti-shield-lock" />
                <p>
                  We'll send a one-time code via SMS to verify this number.
                  Standard messaging rates may apply.
                </p>
              </div>
            </>
          )}

          {/* ══ STEP 2: OTP ══ */}
          {step === "otp" && (
            <>
              <div className={phoneStyles.otpHeadline}>
                <p>
                  We sent a 6-digit code to <strong>{phone}</strong>
                </p>
                <button
                  type="button"
                  className={phoneStyles.changeNumberBtn}
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                >
                  Change number
                </button>
              </div>

              <div className={styles.field}>
                <label>Verification code</label>
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
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    className={phoneStyles.otpInput}
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
            </>
          )}

          {/* ══ STEP 3: BUSINESS NAME + PASSWORD ══ */}
          {step === "business" && (
            <>
              <div className={styles.field}>
                <label>Business name</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-building ${styles.prefix}`} />
                  <input
                    type="text"
                    placeholder="Acme Corporation"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      document.getElementById("phone-signup-password").focus()
                    }
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Password</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    id="phone-signup-password"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      document
                        .getElementById("phone-signup-confirm-password")
                        .focus()
                    }
                  />
                  <button
                    type="button"
                    className={styles.pwToggle}
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <i className={`ti ${showPw ? "ti-eye-off" : "ti-eye"}`} />
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label>Confirm password</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    id="phone-signup-confirm-password"
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateAccount()
                    }
                  />
                  <button
                    type="button"
                    className={styles.pwToggle}
                    onClick={() => setShowConfirmPw((v) => !v)}
                    aria-label={
                      showConfirmPw ? "Hide password" : "Show password"
                    }
                  >
                    <i
                      className={`ti ${showConfirmPw ? "ti-eye-off" : "ti-eye"}`}
                    />
                  </button>
                </div>
                {confirmPassword && (
                  <span
                    className={
                      password === confirmPassword
                        ? styles.matchOk
                        : styles.matchBad
                    }
                  >
                    <i
                      className={`ti ${password === confirmPassword ? "ti-check" : "ti-x"}`}
                    />
                    {password === confirmPassword
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </span>
                )}
              </div>

              <div className={styles.infoBox}>
                <i className="ti ti-shield-lock" />
                <p>
                  Your phone number is verified — this password is all you need
                  going forward.
                </p>
              </div>
            </>
          )}
        </div>

        <div className={styles.formFooter}>
          {step === "phone" && (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? "Sending code…" : "Send verification code"}
              {!loading && <i className="ti ti-arrow-right" />}
            </button>
          )}
          {step === "otp" && (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? "Verifying…" : "Verify code"}
              {!loading && <i className="ti ti-arrow-right" />}
            </button>
          )}
          {step === "business" && (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleCreateAccount}
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
              {!loading && <i className="ti ti-arrow-right" />}
            </button>
          )}
          <p className={styles.footerNote}>
            Already have an account?{" "}
            <a onClick={() => navigate("/login")}>Sign in</a>
          </p>
        </div>
      </div>

      {/* Invisible reCAPTCHA host — Firebase only renders a visible
          challenge into this if it decides the traffic looks risky, per
          sendPhoneOtp()'s "invisible" verifier config. */}
      <div id="recaptcha-container" />
    </div>
  );
}

// Turns Firebase's auth/... error codes into copy a non-technical person
// can act on, instead of surfacing the raw SDK message.
function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-phone-number")) {
    return "That phone number doesn't look valid. Please check it and try again.";
  }
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
