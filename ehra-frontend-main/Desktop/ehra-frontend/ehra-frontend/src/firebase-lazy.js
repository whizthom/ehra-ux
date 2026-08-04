/**
 * Drop-in replacement for the old Firebase-backed phone-OTP helpers
 * (Global Phone Number Authentication rebuild — Firebase → Termii).
 *
 * Same three exported function names, same call signatures, same
 * calling convention as before:
 *   const confirmationResult = await sendPhoneOtp(phoneNumber);
 *   const idToken = await confirmPhoneOtp(confirmationResult, code);
 *   await resetRecaptcha();
 *
 * That's exactly why Login.jsx, Register.jsx, ForgotPassword.jsx and
 * EmployeeRegistration.jsx — all four of which import from this file —
 * needed ZERO changes to their own logic for this migration. Only
 * what's underneath changed: instead of loading the Firebase Auth SDK
 * and running its client-side OTP flow, these now call Ehra's own
 * backend (see api/phoneAuthApi.js), which in turn calls Termii's
 * Send/Verify Token API — Termii's API key has to stay server-side, so
 * unlike Firebase there's no client SDK to lazy-load here at all
 * anymore.
 *
 * Termii's OTP API doesn't need a CAPTCHA challenge the way Firebase's
 * invisible reCAPTCHA did, so resetRecaptcha() is now a no-op — kept
 * only so the resend/retry call sites that still invoke it don't need
 * to change.
 *
 * The filename stays "firebase-lazy" (rather than something like
 * "otp-auth") purely so every existing import keeps working unmodified.
 * Feel free to rename it and update the four import sites together in a
 * future pass — it's no longer doing any lazy-loading, so the name is
 * now just a historical label.
 */

import { sendOtp, verifyOtp } from "./api/phoneAuthApi";

export async function sendPhoneOtp(phoneNumber, _containerId) {
  const { pinId } = await sendOtp(phoneNumber);
  // Shaped to loosely mirror Firebase's ConfirmationResult so
  // confirmPhoneOtp() below has something to thread pinId through —
  // call sites never need to look inside this object themselves.
  return { pinId, phoneNumber };
}

export async function confirmPhoneOtp(confirmationResult, code) {
  const { phoneVerificationToken } = await verifyOtp(
    confirmationResult.pinId,
    code,
  );
  // Plays the exact role a Firebase ID token used to: passed straight
  // into checkPhone / registerWithPhone / verifyPhoneForReset /
  // verifyTwoFactorLogin (api/phoneAuthApi.js) as their "idToken" arg.
  return phoneVerificationToken;
}

export async function resetRecaptcha(_containerId) {
  // No-op — Termii's OTP API has no client-side CAPTCHA challenge to
  // reset. Kept as an export so every existing call site keeps working
  // without changes.
}