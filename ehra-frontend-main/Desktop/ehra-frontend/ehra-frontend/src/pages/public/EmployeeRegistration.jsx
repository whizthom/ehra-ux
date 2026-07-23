import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { sendPhoneOtp, confirmPhoneOtp, resetRecaptcha } from "../../firebase";
import { checkPhone } from "../../api/phoneAuthApi";
import { registerInvitedEmployee } from "../../api/invitationApi";
import styles from "./EmployeeRegistration.module.css";
import phoneStyles from "../PhoneAuth.module.css";

// Same key InvitationLanding.jsx uses to hand off an invite token across a
// trip to /login — reused here so "this phone already has an account"
// lands the person right back at accepting THIS invite once they're
// signed in, instead of a dead end.
const PENDING_INVITE_KEY = "ehra_pending_invite";

const RESEND_COOLDOWN_SECONDS = 30;

const STEPS = [
  { title: "Verify your phone number", sub: "Confirm you own this number" },
  { title: "Enter verification code", sub: "We texted you a 6-digit code" },
  { title: "Personal information", sub: "Your name & date of birth" },
  { title: "Contact details", sub: "Email & home address" },
  { title: "Emergency contact", sub: "Who to reach in an emergency" },
  { title: "Account security", sub: "Set your password" },
];

const BLANK_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  password: "",
  confirmPassword: "",
};

export default function EmployeeRegistration() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Scoped per invite link, so switching between different invite emails
  // (or a colleague opening theirs on the same browser) never mixes drafts.
  // Password fields are deliberately left out of what gets saved — those
  // stay in memory only, and are re-typed if the tab is actually closed.
  // The verified Firebase idToken is NEVER persisted here either — it's
  // short-lived and tied to this browser session; a reload always starts
  // the phone-verification step over rather than trusting a stale one.
  const draftKey = `ehra_employee_reg_${token}`;

  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // A restored step past the phone/OTP stage is only trustworthy if we
  // also still have a live idToken in memory — which a page reload never
  // does, since it's deliberately not persisted. So any reload always
  // resumes at step 1 (phone) rather than landing on a form step it has
  // no verified phone to actually submit with.
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(() => loadDraft()?.phone || "");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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

  // Going "Back" between the form steps (3-6) already preserves
  // everything since `form` lives in this single component — this just
  // also survives a reload or an accidental tab close midway through the
  // invite link. Only reachable once step >= 3 anyway, since step is
  // never restored past 1 on mount.
  useEffect(() => {
    try {
      const { password, confirmPassword, ...safeForm } = form;
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ form: safeForm, phone }),
      );
    } catch {
      // sessionStorage unavailable — the in-page Back button still works fine.
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
  //    an account — if so, this invite gets finished from the login flow
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
              "This phone number already has an Ehra account. Please log in to accept this invitation.",
            phone,
          },
        });
        return;
      }

      setIdToken(verifiedToken);
      setStep(3);
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    if (step === 3) {
      if (!form.firstName.trim()) return "First name is required.";
      if (!form.lastName.trim()) return "Last name is required.";
      if (!form.dateOfBirth) return "Date of birth is required.";
      if (!form.gender) return "Please select a gender.";
    }
    if (step === 4) {
      if (!form.email.trim()) return "Email address is required.";
      if (!form.address.trim()) return "Address is required.";
    }
    if (step === 5) {
      if (!form.emergencyContactName.trim())
        return "Emergency contact name is required.";
      if (!form.emergencyContactPhone.trim())
        return "Emergency contact phone is required.";
    }
    if (step === 6) {
      if (form.password.length < 8)
        return "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword)
        return "Passwords do not match.";
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
    if (step < 6) {
      setStep((s) => s + 1);
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      // No separate login step: registerInvitedEmployee logs the new
      // employee straight in (same as every other registration path —
      // see authApi.js/phoneAuthApi.js) and this navigates directly to
      // their dashboard. Their employer still has to approve the new
      // membership, but that happens from the employer's own dashboard —
      // it's not a gate on the new employee seeing theirs. No email is
      // sent either way; the approval itself shows up as a notification
      // on this employee's own dashboard once it happens.
      const data = await registerInvitedEmployee({
        token,
        idToken,
        ...payload,
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      navigate(
        data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard",
      );
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

  const progress = `${(step / 6) * 100}%`;

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <div className={styles.leftBody}>
          <span className={styles.tagline}>Employee registration</span>
          <h2 className={styles.headline}>Let's get you set up</h2>
          <p className={styles.desc}>
            Verify your phone number, then fill in your details to complete your
            profile and join your team.
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

        <p className={styles.leftFooter}>© 2026 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>
        <div className={styles.mobileHero}>
          <div className={styles.mobileDotGrid} aria-hidden="true" />
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoIcon}>💼</div>
            <span className={styles.mobileLogoText}>Ehra</span>
          </div>
          <p className={styles.mobileEyebrow}>Employee registration</p>
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

        {/* Body */}
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
                  This becomes your permanent Ehra login identity.
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

          {/* Step 3: personal info */}
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
                  <label>Last name *</label>
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
                    Middle name{" "}
                    <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    name="middleName"
                    value={form.middleName}
                    onChange={handle}
                    placeholder="Byron"
                  />
                </div>
                <div className={styles.field}>
                  <label>Date of birth *</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={handle}
                  />
                </div>
                <div className={styles.field}>
                  <label>Gender *</label>
                  <select name="gender" value={form.gender} onChange={handle}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 4: contact details (phone already verified — no phone field here) */}
          {step === 4 && (
            <div className={styles.grid1}>
              <div className={styles.field}>
                <label>Email address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="ada@company.com"
                />
              </div>
              <div className={styles.field}>
                <label>Home address *</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handle}
                  placeholder="123 Main St, Lagos"
                />
              </div>
            </div>
          )}

          {/* Step 5: emergency contact */}
          {step === 5 && (
            <>
              <p className={styles.stepNote}>
                Provide details of someone we can contact on your behalf in case
                of an emergency.
              </p>
              <div className={styles.grid1}>
                <div className={styles.field}>
                  <label>Full name *</label>
                  <input
                    name="emergencyContactName"
                    value={form.emergencyContactName}
                    onChange={handle}
                    placeholder="Jane Lovelace"
                  />
                </div>
                <div className={styles.field}>
                  <label>Phone number *</label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={form.emergencyContactPhone}
                    onChange={handle}
                    placeholder="+234 800 000 0001"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 6: password */}
          {step === 6 && (
            <>
              <p className={styles.stepNote}>
                Choose a strong password to secure your Ehra account.
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
                  : step === 6
                    ? "Submit registration"
                    : "Continue →"}
          </button>
        </div>
      </div>

      {/* Invisible reCAPTCHA host — Firebase only renders a visible
          challenge into this if it decides the traffic looks risky, per
          sendPhoneOtp()'s "invisible" verifier config. Without this
          element present, RecaptchaVerifier's constructor throws
          Firebase: Error (auth/argument-error) the moment sendPhoneOtp
          is called. */}
      <div id="recaptcha-container" />
    </div>
  );
}

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
