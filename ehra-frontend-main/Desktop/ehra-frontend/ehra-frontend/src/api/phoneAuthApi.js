import API, { saveSession } from "./authApi";

// ── OTP (Termii) ─────────────────────────────────────────────────────────
// Global Phone Number Authentication rebuild — Firebase → Termii. These
// two replace what used to be direct Firebase Auth SDK calls in
// ../firebase-lazy; that file now calls these instead of talking to a
// third-party SDK directly, since Termii's API key has to stay
// server-side (unlike Firebase's client-side web config).

// STEP 5: triggers a Termii OTP SMS to phoneNumber. Returns { pinId } —
// hold onto this and send it back, together with the code the person
// types, to verifyOtp() below.
export const sendOtp = (phoneNumber) =>
  API.post("/auth/phone/otp/send", { phoneNumber }).then((r) => r.data);

// STEP 5-6: redeems pinId + the typed code against Termii. Returns
// { phoneVerificationToken, phoneNumber } — phoneVerificationToken is
// what every function below expects as its "idToken" argument.
export const verifyOtp = (pinId, otp) =>
  API.post("/auth/phone/otp/verify", { pinId, otp }).then((r) => r.data);

// ── Registration (STEP 6-9) ─────────────────────────────────────────────

// Checks whether a just-verified phone number already has an Ehra
// account. { exists: boolean, phoneNumber: string }
export const checkPhone = (idToken) =>
  API.post("/auth/phone/check", { idToken }).then((r) => r.data);

// Business Setup (businessName + password) + Personal Information
// (firstName, lastName, email) in one submit — creates the Identity +
// Business, logs the person straight in, and the backend automatically
// queues a verification email for `email` (never awaited — see
// EmailVerificationService). Returns an AuthResponseDTO shape, same as
// login().
export const registerWithPhone = async (idToken, { businessName, password, firstName, lastName, email }) => {
  const { data } = await API.post("/auth/phone/register", {
    idToken,
    businessName,
    password,
    firstName,
    lastName,
    email,
  });
  saveSession(data);
  return data;
};

// ── Login with Two-Factor Authentication ────────────────────────────────

// Second step of login when the initial POST /auth/login response comes
// back with requiresTwoFactor: true. pendingToken is that response's
// twoFactorToken; idToken is a FRESH OTP verification (not the one from
// registration).
export const verifyTwoFactorLogin = async (pendingToken, idToken) => {
  const { data } = await API.post("/auth/2fa/verify", {
    pendingToken,
    idToken,
  });
  saveSession(data);
  return data;
};

// ── Forgot Password ──────────────────────────────────────────────────────

// Step 2: phone OTP just verified — confirms an account exists and
// returns a short-lived resetToken + a masked phone number for display.
export const verifyPhoneForReset = (idToken) =>
  API.post("/auth/phone/forgot/verify", { idToken }).then((r) => r.data);

// Step 4: "Create New Password" — redeems the resetToken. All of the
// account's existing sessions are revoked server-side, so the person logs
// in fresh with the new password everywhere afterward.
export const confirmPasswordReset = (resetToken, newPassword) =>
  API.post("/auth/phone/forgot/reset", { resetToken, newPassword }).then(
    (r) => r.data,
  );

// ── Settings > Security ──────────────────────────────────────────────────

export const getSecuritySettings = () =>
  API.get("/auth/security").then((r) => r.data);

export const toggleTwoFactor = (enabled, password) =>
  API.put("/auth/security/2fa", { enabled, password }).then((r) => r.data);

// ── Email verification ───────────────────────────────────────────────────
// Never a blocker on registration or general product usage — see
// com.Ehra.email.service.EmailVerificationService. Used by the Security
// page's "Verify Email" / "Resend Verification Email" and by the Verify
// page the person lands on after clicking the emailed link.

// Settings > Security's "Verified Email" section. developmentVerificationLink
// is only ever non-null when the backend is running with
// email.provider=mock — the "Development Mode" card.
export const getEmailStatus = () =>
  API.get("/auth/email/status").then((r) => r.data);

// "Verify Email" (first send) and "Resend Verification Email" (expired
// link) are the exact same call — the backend always invalidates any
// still-pending token and issues a fresh one.
export const sendEmailVerification = () =>
  API.post("/auth/email/send-verification").then((r) => r.data);

// Redeems the token from https://ehral.com/verify-email?token=xxxxxxxx —
// public on the backend (the token itself is the credential), so this
// works even if the browser tab clicking the email link isn't logged in.
export const verifyEmailToken = (token) =>
  API.post("/auth/verify-email", { token }).then((r) => r.data);