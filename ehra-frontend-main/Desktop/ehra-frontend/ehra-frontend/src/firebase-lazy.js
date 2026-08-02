/**
 * Drop-in, lazily-loaded replacement for `../firebase`'s phone-auth
 * exports. Same three function names, same signatures, same behavior —
 * the only difference is that `firebase/auth` (and its `libphonenumber`
 * dependency, together ~200KB minified) isn't fetched or parsed until
 * one of these is actually called, instead of being bundled into
 * whichever page imports it.
 *
 * Why this exists: Register, Login, ForgotPassword and
 * EmployeeRegistration all import phone-OTP helpers directly, and all
 * four are public-facing pages that need to render immediately (they're
 * not behind React.lazy — see App.jsx's comment on why auth pages stay
 * eager). Most visits to any of these pages never touch phone auth at
 * all (email/password login, or filling in the business-name step
 * before ever tapping "send code"), so shipping Firebase's auth SDK to
 * every single one of them up front was pure waste. Each of the
 * functions below is only ever called from an event handler (a button
 * click), never during initial render, so deferring the import here has
 * zero effect on behavior — just on when the bytes get downloaded.
 *
 * Nothing about `../firebase` itself changed; this file only adds an
 * indirection in front of it. If a future change needs the underlying
 * Firebase Auth instance directly (not just these three helpers),
 * import `../firebase` as before — this wrapper is additive, not a
 * replacement for that module.
 */

export async function sendPhoneOtp(phoneNumber, containerId) {
  const mod = await import("./firebase");
  return mod.sendPhoneOtp(phoneNumber, containerId);
}

export async function confirmPhoneOtp(confirmationResult, code) {
  const mod = await import("./firebase");
  return mod.confirmPhoneOtp(confirmationResult, code);
}

export async function resetRecaptcha(containerId) {
  const mod = await import("./firebase");
  return mod.resetRecaptcha(containerId);
}