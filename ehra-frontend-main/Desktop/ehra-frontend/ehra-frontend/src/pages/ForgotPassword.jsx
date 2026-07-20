import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { sendPhoneOtp, confirmPhoneOtp, resetRecaptcha } from "../firebase";
import { verifyPhoneForReset, confirmPasswordReset } from "../api/phoneAuthApi";
import styles from "./Login.module.css";
import phoneStyles from "./PhoneAuth.module.css";

const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPassword() {
  const navigate = useNavigate();

  // step: "phone" -> "otp" -> "newPassword" -> "done"
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [resetToken, setResetToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

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

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setLoading(true);
    try {
      const idToken = await confirmPhoneOtp(confirmationResult, otp.trim());
      const { resetToken: token, maskedPhoneNumber } =
        await verifyPhoneForReset(idToken);
      setResetToken(token);
      setMaskedPhone(maskedPhoneNumber);
      setStep("newPassword");
    } catch (err) {
      if (err?.response?.status === 404) {
        setError(
          err.response.data?.message ||
            "No Ehra account was found for this phone number.",
        );
      } else {
        setError(friendlyFirebaseError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(resetToken, newPassword);
      setStep("done");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "This reset link has expired. Please start over.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.left}>
        <div className={styles.dotGrid} aria-hidden="true" />
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>
        <div className={styles.leftBody}>
          <span className={styles.eyebrow}>Account recovery</span>
          <h1 className={styles.headline}>Let's get you back in.</h1>
          <p className={styles.desc}>
            Verify your phone number and set a new password — no email required.
          </p>
        </div>
        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoIcon}>💼</div>
            <span className={styles.mobileLogoText}>Ehra</span>
          </div>

          <div className={styles.rightHeader}>
            <h2 className={styles.h1}>
              {step === "phone" && "Forgot password"}
              {step === "otp" && "Enter the code"}
              {step === "newPassword" && "Create new password"}
              {step === "done" && "All set"}
              <span className={styles.h1Accent} aria-hidden="true" />
            </h2>
            <p className={styles.subtitle}>
              {step === "phone" &&
                "Enter the phone number linked to your account."}
              {step === "otp" && `We sent a 6-digit code to ${phone}`}
              {step === "newPassword" &&
                `Verified — ${maskedPhone}. Choose a new password.`}
              {step === "done" &&
                "Your password has been changed. Please sign in again."}
            </p>
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          {step === "phone" && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Phone number</label>
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
              </div>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSendOtp}
                disabled={loading}
              >
                {loading ? "Sending code…" : "Send verification code"}
                {!loading && <i className="ti ti-arrow-right" />}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div className={phoneStyles.otpHeadline}>
                <p />
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
                {loading ? "Verifying…" : "Verify code"}
                {!loading && <i className="ti ti-arrow-right" />}
              </button>
            </>
          )}

          {step === "newPassword" && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>New password</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                <label className={styles.label}>Confirm new password</label>
                <div className={styles.inputWrap}>
                  <i className={`ti ti-lock ${styles.prefix}`} />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleResetPassword()
                    }
                    className={styles.input}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleResetPassword}
                disabled={loading}
              >
                {loading ? "Saving…" : "Save new password"}
                {!loading && <i className="ti ti-arrow-right" />}
              </button>
            </>
          )}

          {step === "done" && (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => navigate("/login")}
            >
              <span>Go to sign in</span>
              <i className="ti ti-arrow-right" />
            </button>
          )}

          {step !== "done" && (
            <p className={styles.registerLink}>
              Remembered it?{" "}
              <a
                className={styles.registerLinkAnchor}
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </a>
            </p>
          )}
        </div>
      </div>

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
