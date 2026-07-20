import API, { saveSession } from "./authApi";

// ── Registration (STEP 6-9) ─────────────────────────────────────────────

// Checks whether a just-verified phone number already has an Ehra
// account. { exists: boolean, phoneNumber: string }
export const checkPhone = (idToken) =>
  API.post("/auth/phone/check", { idToken }).then((r) => r.data);

// Business name + password only — creates the Identity + Business, logs
// the person straight in. Returns an AuthResponseDTO shape, same as login().
export const registerWithPhone = async (idToken, businessName, password) => {
  const { data } = await API.post("/auth/phone/register", {
    idToken,
    businessName,
    password,
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
