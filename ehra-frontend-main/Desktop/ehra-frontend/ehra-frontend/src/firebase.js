import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

// Public client config — see .env.example. Safe to ship in the bundle;
// Firebase's actual security boundary is server-side ID token
// verification (see FirebaseTokenVerifier on the backend), not secrecy of
// these values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

// ── Invisible reCAPTCHA ─────────────────────────────────────────────────
//
// "The user should only see it if required by Firebase" — an invisible
// verifier is exactly that contract: it runs silently in the background
// and Firebase only surfaces a visible challenge if it decides the
// traffic looks risky. One verifier instance per container id; callers
// must render a matching <div id={containerId} /> before calling this.
//
// Kept in a small registry (not a single module-level singleton) so a
// page that mounts more than one phone-otp flow (unlikely, but e.g. a
// register step and a forgot-password step both present at once in some
// future layout) never fights over one verifier instance.
const verifiers = new Map();

function getRecaptchaVerifier(containerId) {
  if (!verifiers.has(containerId)) {
    verifiers.set(
      containerId,
      new RecaptchaVerifier(firebaseAuth, containerId, {
        size: "invisible",
      }),
    );
  }
  return verifiers.get(containerId);
}

/**
 * Sends an OTP to `phoneNumber` (must already be in E.164 format, e.g.
 * "+2348012345678") via Firebase Phone Authentication. Returns Firebase's
 * ConfirmationResult — hang onto it and pass it to confirmOtp() once the
 * person types the code.
 */
export async function sendPhoneOtp(phoneNumber, containerId = "recaptcha-container") {
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
}

/**
 * Confirms the OTP the person typed in against Firebase, then returns the
 * Firebase ID token — this is what every backend phone-auth endpoint
 * (see phoneAuthApi.js) expects as `idToken`. The backend re-verifies it
 * server-side; nothing here is trusted on its own.
 */
export async function confirmPhoneOtp(confirmationResult, code) {
  const credential = await confirmationResult.confirm(code);
  return credential.user.getIdToken();
}

/**
 * Resets a container's reCAPTCHA verifier — call this after a failed
 * send/verify so "resend code" gets a fresh challenge instead of reusing
 * one Firebase may have already flagged.
 */
export function resetRecaptcha(containerId = "recaptcha-container") {
  const existing = verifiers.get(containerId);
  if (existing) {
    existing.clear();
    verifiers.delete(containerId);
  }
}
