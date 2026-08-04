import API from "./authApi";

// ── Subscription / billing service methods ──────────────────────────────────
//
// These call backend endpoints that don't exist yet (the backend pass for
// this feature is next). They're written against the API shape the backend
// should expose, so wiring them up later is a matter of implementing the
// controller — nothing here should need to change.
//
// Expected backend contract:
//   POST /subscription/checkout/initialize { planId, billingCycle }
//     -> { reference, amount, email, publicKey }
//   POST /subscription/checkout/verify { reference }
//     -> { status: "SUCCESS" | "FAILED" | "PENDING", plan, expiresAt }
//   GET  /subscription/me
//     -> { plan, billingCycle, status, expiresAt, ... }
//   POST /subscription/cancel
//     -> { status }
//
// Until the backend exists, calls below reject with a normal axios error
// (404/network error) — callers surface that as "checkout isn't available
// yet" rather than silently pretending a payment succeeded.

export const getMySubscription = () => API.get("/subscription/me").then((r) => r.data);

export const initializeCheckout = (planId, billingCycle) =>
  API.post("/subscription/checkout/initialize", { planId, billingCycle }).then(
    (r) => r.data
  );

export const verifyCheckout = (reference) =>
  API.post("/subscription/checkout/verify", { reference }).then((r) => r.data);

export const cancelSubscription = () =>
  API.post("/subscription/cancel").then((r) => r.data);

// ── Paystack Inline JS ───────────────────────────────────────────────────────
//
// Loaded lazily (not in index.html) so the ~40KB script only ever downloads
// for someone actually reaching the checkout step, not on every page load.
// The public key is safe to ship in the client bundle — it's the same key
// Paystack's own docs put directly in browser-side code. The SECRET key
// never belongs on the frontend; it stays backend-only, used to verify
// transactions server-side.
const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v2/inline.js";

let paystackScriptPromise = null;

function loadPaystackScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack can only load in the browser."));
  }
  if (window.PaystackPop) return Promise.resolve();

  if (!paystackScriptPromise) {
    paystackScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${PAYSTACK_SCRIPT_SRC}"]`
      );
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Paystack."))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = PAYSTACK_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paystack."));
      document.body.appendChild(script);
    });
  }

  return paystackScriptPromise;
}

/**
 * Opens the Paystack Inline popup for one checkout attempt.
 *
 * @param {object} params
 * @param {string} params.email - the paying business's email.
 * @param {number} params.amountNaira - amount in naira (converted to kobo here).
 * @param {string} params.reference - unique transaction reference, from
 *   initializeCheckout() so the backend can verify the same transaction it
 *   created.
 * @param {(reference: string) => void} params.onSuccess - called with the
 *   Paystack reference once the popup reports success. The caller is still
 *   responsible for calling verifyCheckout(reference) against the backend —
 *   a client-side "success" callback is never sufficient proof of payment
 *   on its own.
 * @param {() => void} [params.onClose] - called if the popup is dismissed
 *   without completing payment.
 * @param {string} [params.publicKey] - overrides VITE_PAYSTACK_PUBLIC_KEY.
 *   Prefer letting the backend's checkout-initialize response supply this
 *   (it's the source of truth for which Paystack account/mode is active),
 *   falling back to the env var only if the backend didn't send one.
 */
export async function payWithPaystack({
  email,
  amountNaira,
  reference,
  onSuccess,
  onClose,
  publicKey: publicKeyOverride,
}) {
  const publicKey = publicKeyOverride || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "VITE_PAYSTACK_PUBLIC_KEY is not set — add it to your .env file."
    );
  }

  await loadPaystackScript();

  const popup = new window.PaystackPop();
  popup.newTransaction({
    key: publicKey,
    email,
    amount: Math.round(amountNaira * 100), // kobo
    ref: reference,
    currency: "NGN",
    onSuccess: (transaction) => onSuccess?.(transaction.reference ?? reference),
    onCancel: () => onClose?.(),
  });
}