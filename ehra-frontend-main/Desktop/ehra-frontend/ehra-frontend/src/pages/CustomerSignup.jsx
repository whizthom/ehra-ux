import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useAuth } from "../context/AuthContext";
import {
  checkPhoneBeforeOtp,
  sendCustomerRegistrationOtp,
  verifyOtp,
  checkPhone,
  registerCustomerWithPhone,
} from "../api/phoneAuthApi";
import DevOtpCard from "../components/DevOtpCard";
import { describeApiError } from "../utils/apiErrors";
import styles from "./Login.module.css";
import phoneStyles from "./PhoneAuth.module.css";
import extra from "./CustomerSignup.module.css";
import Logo from "../components/Logo";
import AboutEhralLink from "../components/nav/AboutEhralLink";
import AuthTabs from "../components/auth/AuthTabs";

const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  {
    icon: "ti-building-store",
    title: "Discover businesses",
    text: "Browse storefronts and connect with the ones you like.",
  },
  {
    icon: "ti-package",
    title: "Follow every order",
    text: "Updates from confirmation through to delivery.",
  },
  {
    icon: "ti-ticket",
    title: "Coupons and messages",
    text: "Rewards and replies from each business, in one place.",
  },
];

const STEP_NUMBER = { phone: 1, otp: 2, details: 3 };

// Customer sign up - the second tab on the sign-in screen. A customer account
// belongs to the person, not to a business: it's the same Ehra identity that
// can later also own a workspace or join one as staff. So this flow only needs
// a verified phone number, a few details and a password.
export default function CustomerSignup() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  // step: "phone" -> "otp" -> "details"
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [pinId, setPinId] = useState("");
  const [devOtp, setDevOtp] = useState(undefined);
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const otpInputRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
    if (step === "details") firstNameRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // A phone that already has an Ehra account never continues into sign up -
  // it goes to sign in with the number filled in.
  const goToSignIn = (knownPhone, message) =>
    navigate("/login", {
      replace: true,
      state: {
        phone: knownPhone,
        message:
          message ||
          "This phone number already has an Ehra account. Please sign in.",
      },
    });

  const handleSendOtp = async () => {
    setError("");
    if (!phone || !isValidPhoneNumber(phone)) {
      setError("Enter a valid phone number, including country code.");
      return;
    }
    setLoading(true);
    try {
      const check = await checkPhoneBeforeOtp(phone);
      if (check?.exists) {
        goToSignIn(check.phoneNumber || phone);
        return;
      }
      const result = await sendCustomerRegistrationOtp(phone);
      setPinId(result?.pinId || "");
      setDevOtp(result?.developmentOtp);
      setOtp("");
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err?.response?.status === 409) {
        goToSignIn(phone, err.response.data?.message);
        return;
      }
      const message = describeApiError(
        err,
        "We couldn't send a code to that number. Please try again.",
      );
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    setError("");
    setLoading(true);
    try {
      const result = await sendCustomerRegistrationOtp(phone);
      setPinId(result?.pinId || "");
      setDevOtp(result?.developmentOtp);
      setOtp("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message = describeApiError(
        err,
        "Couldn't resend the code. Please try again.",
      );
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setLoading(true);
    try {
      const verified = await verifyOtp(pinId, otp.trim());
      const check = await checkPhone(verified.phoneVerificationToken);
      if (check.exists) {
        goToSignIn(verified.phoneNumber || phone);
        return;
      }
      setVerificationToken(verified.phoneVerificationToken);
      setStep("details");
    } catch (err) {
      const message = describeApiError(
        err,
        "That code is incorrect or has expired.",
      );
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setError("");
    if (!firstName.trim()) {
      setError("Enter your first name.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
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
    if (!termsAccepted) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy before creating your account.",
      );
      return;
    }

    setLoading(true);
    try {
      const data = await registerCustomerWithPhone(verificationToken, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      // registerCustomerWithPhone saves the session itself (like the business
      // sign up does) - refreshSession() lets the rest of the app see it.
      refreshSession?.();
      navigate(
        data.needsContextSelection
          ? "/select-workspace"
          : "/customer-dashboard?tab=discover",
        {
          replace: true,
          state: { justRegistered: true, firstName: firstName.trim() },
        },
      );
    } catch (err) {
      if (err?.response?.status === 409) {
        goToSignIn(phone, err.response.data?.message);
        return;
      }
      const data = err?.response?.data;
      if (data?.errors) {
        setError(Object.values(data.errors)[0]);
      } else {
        const message = describeApiError(
          err,
          "Something went wrong. Please try again.",
        );
        if (message) setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const stepNumber = STEP_NUMBER[step];
  const passwordsMatch = password === confirmPassword;

  // Enter on a field moves to the next one (only called from event handlers).
  const advance = (e, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className={styles.wrap}>
      {/* ── Left panel - what a customer account is for ── */}
      <div className={styles.left}>
        <div className={styles.dotGrid} aria-hidden="true" />
        <AboutEhralLink tone="dark" />

        <div className={styles.logoRow} style={{ "--text-primary": "#ffffff" }}>
          <Logo variant="horizontal" size={80} />
        </div>

        <div className={styles.leftBody}>
          <h1 className={styles.headline}>
            One account for every business you buy from.
          </h1>
          <p className={styles.desc}>
            Discover storefronts, follow your orders and hear from the
            businesses you trust, all from one place.
          </p>

          <ul className={extra.benefits}>
            {BENEFITS.map((b) => (
              <li className={extra.benefit} key={b.title}>
                <span className={extra.benefitIcon} aria-hidden="true">
                  <i className={`ti ${b.icon}`} />
                </span>
                <span className={extra.benefitBody}>
                  <span className={extra.benefitTitle}>{b.title}</span>
                  <span className={extra.benefitText}>{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.leftFooter}>© 2026 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right panel - sign up ── */}
      <div className={styles.right}>
        <AboutEhralLink tone="light" className={styles.mobileOnlyAboutLink} />
        <div
          className={styles.mobileLogoRow}
          style={{ "--text-primary": "#0b1f1a" }}
        >
          <Logo variant="horizontal" size={56} />
        </div>

        {step === "phone" && (
          <div className={styles.tabsRow}>
            <AuthTabs active="customer" />
          </div>
        )}

        <div className={styles.card}>
          <div className={extra.progress}>
            <div
              className={extra.progressBars}
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={stepNumber}
              aria-label={`Step ${stepNumber} of 3`}
            >
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`${extra.progressBar} ${n <= stepNumber ? extra.progressBarOn : ""}`}
                />
              ))}
            </div>
            <span className={extra.progressCount}>Step {stepNumber} of 3</span>
          </div>

          <div className={styles.rightHeader}>
            <h2 className={styles.h1}>
              {step === "phone" && "Create your customer account"}
              {step === "otp" && "Verify your number"}
              {step === "details" && "Almost there"}
              <span className={styles.h1Accent} aria-hidden="true" />
            </h2>
            <p className={styles.subtitle}>
              {step === "phone" &&
                "Start with your phone number. It becomes your Ehra login."}
              {step === "otp" && "Enter the 6-digit code we just texted you."}
              {step === "details" && "Add your details and choose a password."}
            </p>
          </div>

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
                <label className={styles.label} htmlFor="cs-phone">
                  Phone number
                </label>
                <div className={phoneStyles.phoneInputWrap}>
                  <PhoneInput
                    id="cs-phone"
                    international
                    defaultCountry="NG"
                    countryCallingCodeEditable={false}
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(value) => setPhone(value || "")}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className={`${phoneStyles.phoneInput} ${styles.phoneOverride}`}
                  />
                </div>
              </div>

              <div className={extra.infoBox}>
                <i className="ti ti-shield-lock" aria-hidden="true" />
                <p>
                  We'll text a one-time code to verify this number. Standard
                  messaging rates may apply.
                </p>
              </div>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    <span>Sending code…</span>
                  </>
                ) : (
                  <>
                    <span>Send verification code</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </>
          )}

          {/* ══ STEP 2: OTP ══ */}
          {step === "otp" && (
            <>
              <div className={phoneStyles.otpHeadline}>
                <p>
                  Code sent to <strong>{phone}</strong>
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

              <DevOtpCard code={devOtp} />

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cs-otp">
                  Verification code
                </label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-shield-check ${styles.prefix}`} />
                  <input
                    id="cs-otp"
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
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <span>Verify code</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </>
          )}

          {/* ══ STEP 3: DETAILS + PASSWORD ══ */}
          {step === "details" && (
            <>
              <div className={extra.nameRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cs-first">
                    First name
                  </label>
                  <input
                    id="cs-first"
                    ref={firstNameRef}
                    type="text"
                    autoComplete="given-name"
                    placeholder="Amaka"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => advance(e, lastNameRef)}
                    className={`${styles.input} ${extra.plainInput}`}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cs-last">
                    Last name
                  </label>
                  <input
                    id="cs-last"
                    ref={lastNameRef}
                    type="text"
                    autoComplete="family-name"
                    placeholder="Okafor"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={(e) => advance(e, emailRef)}
                    className={`${styles.input} ${extra.plainInput}`}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cs-email">
                  Email address
                </label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-mail ${styles.prefix}`} />
                  <input
                    id="cs-email"
                    ref={emailRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="amaka@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => advance(e, passwordRef)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cs-password">
                  Password
                </label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    id="cs-password"
                    ref={passwordRef}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => advance(e, confirmRef)}
                    className={styles.input}
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

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cs-confirm">
                  Confirm password
                </label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    id="cs-confirm"
                    ref={confirmRef}
                    type={showConfirmPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateAccount()
                    }
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
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
                    className={passwordsMatch ? extra.matchOk : extra.matchBad}
                    role="status"
                  >
                    <i
                      className={`ti ${passwordsMatch ? "ti-check" : "ti-x"}`}
                    />
                    {passwordsMatch
                      ? "Passwords match"
                      : "Passwords don't match"}
                  </span>
                )}
              </div>

              <label className={extra.termsCheck}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setError("");
                  }}
                />
                <span className={extra.termsBox} aria-hidden="true">
                  <i className="ti ti-check" />
                </span>
                <span className={extra.termsText}>
                  I agree to Ehra's{" "}
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

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleCreateAccount}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    <span>Creating account…</span>
                  </>
                ) : (
                  <>
                    <span>Create customer account</span>
                    <i className="ti ti-arrow-right" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
