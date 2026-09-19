import API, { saveSession } from "./authApi";

// ── OTP (Termii) ─────────────────────────────────────────────────────────
// Global Phone Number Authentication rebuild - Firebase → Termii. These
// two replace what used to be direct Firebase Auth SDK calls in
// ../firebase-lazy; that file now calls these instead of talking to a
// third-party SDK directly, since Termii's API key has to stay server-side
// (unlike Firebase's client-side web config).

// ── Registration phone pre-check ─────────────────────────────────────────
// Determines whether this phone already has an Ehral Identity BEFORE a
// registration OTP is sent.
//
// Existing Ehral numbers must NOT receive a registration OTP. The caller
// should route them to Login / Forgot Password instead.
//
// New numbers proceed to the registration OTP flow.
export const checkPhoneBeforeOtp = (phoneNumber) =>
  API.post("/auth/phone/check-before-otp", { phoneNumber }).then(
    (r) => r.data,
  );

// ── General phone OTP ────────────────────────────────────────────────────
// Used for authentication/recovery flows that legitimately require a phone
// OTP. This is NOT the registration-specific OTP endpoint.
//
// For customer registration, use sendCustomerRegistrationOtp() instead so
// the backend performs its own existence check immediately before sending.
export const sendOtp = (phoneNumber) =>
  API.post("/auth/phone/otp/send", { phoneNumber }).then((r) => r.data);

// ── Customer registration OTP ───────────────────────────────────────────
// Registration-only OTP endpoint.
//
// The backend checks whether the phone already belongs to an Ehral Identity
// immediately before dispatching the OTP. This protects the flow even if a
// caller bypasses the frontend pre-check.
//
// Existing Ehral numbers must therefore never receive a registration OTP.
export const sendCustomerRegistrationOtp = (phoneNumber) =>
  API.post("/auth/phone/customer-registration/otp/send", { phoneNumber }).then(
    (r) => r.data,
  );

// ── Verify phone OTP ─────────────────────────────────────────────────────
// Redeems pinId + the typed OTP code.
//
// Returns:
//   {
//     phoneVerificationToken,
//     phoneNumber
//   }
//
// phoneVerificationToken is subsequently used by the authenticated
// registration/recovery functions that require proof of phone ownership.
export const verifyOtp = (pinId, otp) =>
  API.post("/auth/phone/otp/verify", { pinId, otp }).then((r) => r.data);

// ── Registration / phone identity checks ─────────────────────────────────

// Checks whether a verified phone number already has an Ehral account.
//
// Returns:
//   {
//     exists: boolean,
//     phoneNumber: string
//   }
//
// This remains useful after OTP verification for flows that need the
// verified identity state.
export const checkPhone = (idToken) =>
  API.post("/auth/phone/check", { idToken }).then((r) => r.data);

// ── Customer registration ───────────────────────────────────────────────
// Creates a customer account using a verified phone token.
//
// The backend independently rejects an existing Ehral Identity, so the
// frontend check is not the security boundary.
export const registerCustomerWithPhone = async (
  idToken,
  { businessSlug, firstName, lastName, email, password },
) => {
  const { data } = await API.post("/auth/phone/customer-register", {
    idToken,
    businessSlug,
    firstName,
    lastName,
    email,
    password,
  });

  saveSession(data);
  return data;
};

// ── General phone registration ──────────────────────────────────────────
// Existing employer/business registration flow.
export const registerWithPhone = async (
  idToken,
  { businessName, password, firstName, lastName, email },
) => {
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

// ── Login with Two-Factor Authentication ─────────────────────────────────

// Second step of login when the initial POST /auth/login response returns
// requiresTwoFactor: true.
//
// pendingToken is the twoFactorToken returned by the initial login.
// idToken is a FRESH phone OTP verification token.
export const verifyTwoFactorLogin = async (pendingToken, idToken) => {
  const { data } = await API.post("/auth/2fa/verify", {
    pendingToken,
    idToken,
  });

  saveSession(data);
  return data;
};

// ── Login with Two-Factor Authentication - EMAIL method ──────────────────

// Used when POST /auth/login returns:
//   requiresTwoFactor: true
//   twoFactorMethod: "EMAIL"
//
// The backend has already sent the email verification code. This function
// verifies the code entered by the user.
export const verifyEmailTwoFactorLogin = async (pendingToken, code) => {
  const { data } = await API.post("/auth/2fa/email/verify", {
    pendingToken,
    code,
  });

  saveSession(data);
  return data;
};

// Resends the email two-factor authentication code.
export const resendEmailTwoFactorCode = (pendingToken) =>
  API.post("/auth/2fa/email/resend", { pendingToken }).then((r) => r.data);

// ── Forgot Password ──────────────────────────────────────────────────────

// Verifies that the phone OTP belongs to an existing Ehral account.
//
// Returns a short-lived resetToken and masked phone information for the
// password-reset flow.
export const verifyPhoneForReset = (idToken) =>
  API.post("/auth/phone/forgot/verify", { idToken }).then((r) => r.data);

// Completes the password reset using the short-lived resetToken.
//
// The backend revokes existing sessions so the user must authenticate
// again using the new password.
export const confirmPasswordReset = (resetToken, newPassword) =>
  API.post("/auth/phone/forgot/reset", {
    resetToken,
    newPassword,
  }).then((r) => r.data);

// ── Settings > Security ──────────────────────────────────────────────────

export const getSecuritySettings = () =>
  API.get("/auth/security").then((r) => r.data);

export const toggleTwoFactor = (enabled, password, method) =>
  API.put("/auth/security/2fa", {
    enabled,
    password,
    method,
  }).then((r) => r.data);

// ── Email verification: PERSONAL (Identity#email) ─────────────────────────

// Optional everywhere. This is the shared verified email associated with
// the Ehral Identity, regardless of the current employer/employee context.

export const getEmailStatus = () =>
  API.get("/auth/email/status").then((r) => r.data);

// Sends or resends the Identity email verification message.
//
// If email is provided, verification is sent to that specific address.
// Otherwise the backend uses the currently pending/associated address.
export const sendEmailVerification = (email) =>
  API.post(
    "/auth/email/send-verification",
    email ? { email } : {},
  ).then((r) => r.data);

// Redeems the verification token from the public email-verification link.
//
// Example route:
//   /verify-email?token=xxxxxxxx
//
// The token itself authenticates the verification request, so the user
// does not need to be logged in when clicking the email link.
export const verifyEmailToken = (token) =>
  API.post("/auth/verify-email", { token }).then((r) => r.data);