import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  sendPhoneOtp,
  confirmPhoneOtp,
  resetRecaptcha,
} from "../../firebase-lazy";
import { checkPhone } from "../../api/phoneAuthApi";
import { registerInvitedCustomer } from "../../api/invitationApi";
import DevOtpCard from "../../components/DevOtpCard";
import styles from "./EmployeeRegistration.module.css";
import phoneStyles from "../PhoneAuth.module.css";
import Logo from "../../components/Logo";
import AboutEhralLink from "../../components/nav/AboutEhralLink";

// Same key InvitationLanding.jsx uses to hand off an invite token across a
// trip to /login - reused here so "this phone already has an account"
// lands the person right back at accepting THIS invite once they're
// signed in, instead of a dead end.
const PENDING_INVITE_KEY = "ehra_pending_invite";

const RESEND_COOLDOWN_SECONDS = 30;

// Deliberately a much shorter flow than EmployeeRegistration's six steps -
// a customer relationship doesn't need a date of birth, gender, home
// address, or emergency contact, so this asks for the bare minimum
// (verified phone, a name, and a password) and gets the person to their
// customer dashboard in under a minute. See CustomerInvitationRegisterDTO
// on the backend.
const STEPS = [
  { title: "Verify your phone number", sub: "Confirm you own this number" },
  { title: "Enter verification code", sub: "We texted you a 6-digit code" },
  { title: "Your details", sub: "Just your name and, optionally, email" },
  { title: "Account security", sub: "Set your password" },
];

const BLANK_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function CustomerInvitationRegistration() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Scoped per invite link - same reasoning as EmployeeRegistration's
  // draftKey. Password fields are deliberately left out of what's saved;
  // the verified idToken is never persisted either.
  const draftKey = `ehra_customer_reg_${token}`;

  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(() => loadDraft()?.phone || "");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [form, setForm] = useState(() => ({
    ...BLANK_FORM,
    ...(loadDraft()?.form || {}),
  }));

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (step === 2) otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    try {
      const { password, confirmPassword, ...safeForm } = form;
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ form: safeForm, phone }),
      );
    } catch {
      // sessionStorage unavailable - the in-page Back button still works fine.
    }
  }, [form, phone, draftKey]);

  const handle = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

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
      setStep(2);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      resetRecaptcha();
      setError(friendlyOtpError(err));
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
      setError(friendlyOtpError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2 -> 3: verify the OTP, then check if this phone already has
  //    an account - if so, this invite gets finished from the login flow
  //    instead of creating a duplicate Identity ─────────────────────────
  const handleVerifyOtp = async () => {
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }

    setLoading(true);
    try {
      const verifiedToken = await confirmPhoneOtp(
        confirmationResult,
        otp.trim(),
      );

      const check = await checkPhone(verifiedToken);
      if (check.exists) {
        sessionStorage.setItem(PENDING_INVITE_KEY, token);
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        navigate("/login", {
          state: {
            message:
              "This phone number already has an Ehral account. Please log in to accept this invitation.",
            phone,
          },
        });
        return;
      }

      setIdToken(verifiedToken);
      setStep(3);
    } catch (err) {
      setError(friendlyOtpError(err));
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    if (step === 3) {
      if (!form.firstName.trim()) return "First name is required.";
    }
    if (step === 4) {
      if (form.password.length < 8)
        return "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword)
        return "Passwords do not match.";
      if (!termsAccepted)
        return "Please agree to the Terms of Service and Privacy Policy before submitting.";
    }
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step < STEPS.length) {
      setStep((s) => s + 1);
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      // No separate login step: registerInvitedCustomer logs the new
      // customer straight in and this navigates directly to their
      // customer dashboard - the relationship with the inviting business
      // is active immediately, no approval step to wait on.
      const data = await registerInvitedCustomer({
        token,
        idToken,
        ...payload,
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      navigate("/customer-dashboard");
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Submission failed. Please try again.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const pwRules = [
    { label: "At least 8 characters", ok: form.password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(form.password) },
    { label: "One number", ok: /[0-9]/.test(form.password) },
  ];

  const progress = `${(step / STEPS.length) * 100}%`;

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <AboutEhralLink tone="dark" />
        <div className={styles.logoRow} style={{ "--text-primary": "#ffffff" }}>
          <Logo variant="horizontal" size={80} />
        </div>

        <div className={styles.leftBody}>
          <span className={styles.tagline}>Customer sign-up</span>
          <h2 className={styles.headline}>Let's get you connected</h2>
          <p className={styles.desc}>
            Verify your phone number, then fill in a couple of details to finish
            connecting with this business.
          </p>

          <div className={styles.steps}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={n} className={styles.step}>
                  {n < STEPS.length && <div className={styles.stepLine} />}
                  <div
                    className={`${styles.stepDot} ${done ? styles.dotDone : active ? styles.dotActive : styles.dotPending}`}
                  >
                    {done ? "✓" : n}
                  </div>
                  <div className={styles.stepBody}>
                    <p className={styles.stepLabel}>{s.title}</p>
                    <p className={styles.stepSub}>{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className={styles.leftFooter}>© 2026 Ehral. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>
        <AboutEhralLink tone="light" className={styles.mobileOnlyAboutLink} />
        <div className={styles.mobileHero}>
          <div className={styles.mobileDotGrid} aria-hidden="true" />
          <div
            className={styles.mobileLogoRow}
            style={{ "--text-primary": "#ffffff" }}
          >
            <Logo variant="horizontal" size={64} />
          </div>
          <p className={styles.mobileEyebrow}>Customer sign-up</p>
          <h1 className={styles.mobileHeadline}>{STEPS[step - 1].title}</h1>

          <div className={styles.mobileSteps}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <span
                  key={n}
                  className={`${styles.mobileStepDot} ${done ? styles.mobileStepDone : ""} ${active ? styles.mobileStepActive : ""}`}
                  aria-label={s.title}
                />
              );
            })}
          </div>
        </div>

        {/* Header */}
        <div className={styles.rightHeader}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: progress }} />
          </div>
          <div className={styles.headerRow}>
            <span className={styles.stepTitle}>{STEPS[step - 1].title}</span>
            <span className={styles.stepCount}>
              Step {step} of {STEPS.length}
            </span>
          </div>
        </div>

        <div className={styles.formArea}>
          <div className={styles.formBody}>
            {error && (
              <div className={styles.errorBox}>
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: phone */}
            {step === 1 && (
              <>
                <div className={styles.field}>
                  <label>Phone number *</label>
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
                    This becomes your permanent Ehral login identity.
                  </span>
                </div>
                <p className={styles.stepNote}>
                  We'll send a one-time code via SMS to verify this number.
                  Standard messaging rates may apply.
                </p>
              </>
            )}

            {/* Step 2: OTP */}
            {step === 2 && (
              <>
                <div className={phoneStyles.otpHeadline}>
                  <p>
                    We sent a 6-digit code to <strong>{phone}</strong>
                  </p>
                  <button
                    type="button"
                    className={phoneStyles.changeNumberBtn}
                    onClick={() => {
                      setStep(1);
                      setOtp("");
                      setError("");
                    }}
                  >
                    Change number
                  </button>
                </div>

                <DevOtpCard code={confirmationResult?.developmentOtp} />

                <div className={styles.field}>
                  <label>Verification code *</label>
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

            {/* Step 3: name + optional email */}
            {step === 3 && (
              <>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label>First name *</label>
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handle}
                      placeholder="Ada"
                    />
                  </div>
                  <div className={styles.field}>
                    <label>
                      Last name{" "}
                      <span className={styles.optional}>(optional)</span>
                    </label>
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handle}
                      placeholder="Lovelace"
                    />
                  </div>
                </div>
                <div className={styles.grid1}>
                  <div className={styles.field}>
                    <label>
                      Email address{" "}
                      <span className={styles.optional}>(optional)</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handle}
                      placeholder="ada@example.com"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 4: password */}
            {step === 4 && (
              <>
                <p className={styles.stepNote}>
                  Choose a strong password to secure your Ehral account.
                </p>
                <div className={styles.grid1}>
                  <div className={styles.field}>
                    <label>Password *</label>
                    <div className={styles.pwWrap}>
                      <input
                        type={showPw ? "text" : "password"}
                        name="password"
                        value={form.password}
                        onChange={handle}
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        className={styles.pwToggle}
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Confirm password *</label>
                    <div className={styles.pwWrap}>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handle}
                        placeholder="Repeat your password"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.pwRules}>
                  <p className={styles.pwRulesTitle}>Password requirements</p>
                  {pwRules.map((r) => (
                    <div
                      key={r.label}
                      className={`${styles.pwRule} ${r.ok ? styles.pwRuleOk : ""}`}
                    >
                      <span>{r.ok ? "✓" : "○"}</span>
                      {r.label}
                    </div>
                  ))}
                </div>

                <label className={styles.termsCheck}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (e.target.checked) setError("");
                    }}
                  />
                  <span className={styles.termsBox} aria-hidden="true">
                    <i className="ti ti-check" />
                  </span>
                  <span className={styles.termsText}>
                    I agree to Ehral's{" "}
                    <a href="/terms" target="_blank" rel="noreferrer">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={styles.formFooter}>
            {step > 1 && (
              <button
                type="button"
                className={styles.btnBack}
                onClick={() => {
                  setStep((s) => s - 1);
                  setError("");
                }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className={styles.btnNext}
              onClick={
                step === 1 ? handleSendOtp : step === 2 ? handleVerifyOtp : next
              }
              disabled={loading}
            >
              {loading
                ? "Please wait…"
                : step === 1
                  ? "Send code →"
                  : step === 2
                    ? "Verify code →"
                    : step === STEPS.length
                      ? "Submit"
                      : "Continue →"}
            </button>
          </div>
        </div>
      </div>

      {/* Invisible reCAPTCHA host - see EmployeeRegistration.jsx's identical note. */}
      <div id="recaptcha-container" />
    </div>
  );
}

function friendlyOtpError(err) {
  const backendMessage = err?.response?.data?.message;
  if (backendMessage) {
    return backendMessage;
  }
  if (err?.code === "ERR_NETWORK") {
    return "Network error - please check your connection and try again.";
  }
  return err?.message || "Something went wrong. Please try again.";
}
