import API from "./authApi";

// ── Business: Online Ordering payment setup & reporting ─────────────────────
// Backend: com.Ehra.payments.controller.BusinessOrderPaymentController
// (/api/business/order-payments/**). Separate from Ehral's own
// subscription billing. This is the customer-pays-business order flow.

export const getOnlinePaymentTerms = () =>
  API.get("/business/order-payments/terms").then((r) => r.data);

export const getOnlinePaymentAccountStatus = () =>
  API.get("/business/order-payments/status").then((r) => r.data);

export const listSettlementBanks = () =>
  API.get("/business/order-payments/banks").then((r) => r.data);

export const resolveSettlementAccount = (bankCode, accountNumber) =>
  API.post("/business/order-payments/resolve-account", {
    bankCode,
    accountNumber,
  }).then((r) => r.data);

export const activateOnlinePayments = ({
  bankCode,
  accountNumber,
  termsVersion,
  termsAccepted,
}) =>
  API.post("/business/order-payments/activate", {
    bankCode,
    accountNumber,
    termsVersion,
    termsAccepted,
  }).then((r) => r.data);

export const suspendOnlinePayments = () =>
  API.post("/business/order-payments/suspend").then((r) => r.data);

export const resumeOnlinePayments = () =>
  API.post("/business/order-payments/resume").then((r) => r.data);

export const getOrderPaymentBreakdown = (orderId) =>
  API.get(`/business/order-payments/orders/${orderId}/breakdown`).then(
    (r) => r.data
  );

export const getOrderPaymentSummary = (from, to) =>
  API.get("/business/order-payments/summary", { params: { from, to } }).then(
    (r) => r.data
  );

export const refundOrderPayment = (orderId, { amount, reason }) =>
  API.post(`/business/order-payments/orders/${orderId}/refund`, {
    amount,
    reason,
  }).then((r) => r.data);

// ── Customer: paying for an order ────────────────────────────────────────────
// Backend: com.Ehra.payments.controller.CustomerOrderPaymentController
// (/api/customer/orders/{orderId}/payments/**).

export const initializeOrderPayment = (orderId) =>
  API.post(`/customer/orders/${orderId}/payments/initialize`).then(
    (r) => r.data
  );

export const verifyOrderPayment = (orderId, reference) =>
  API.post(`/customer/orders/${orderId}/payments/verify`, null, {
    params: { reference },
  }).then((r) => r.data);

export const getCustomerOrderPaymentStatus = (orderId) =>
  API.get(`/customer/orders/${orderId}/payments/status`).then((r) => r.data);

// Paystack InlineJS v2. The order payment is initialized on Ehral's backend
// first. The frontend MUST resume that exact transaction with accessCode.
// Do not call newTransaction() here because that would create a second
// browser-side transaction instead of completing the server-initialized one.
const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v2/inline.js";
let paystackScriptPromise = null;

function loadPaystackScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack can only load in the browser."));
  }

  if (window.PaystackPop) {
    return Promise.resolve();
  }

  if (!paystackScriptPromise) {
    paystackScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${PAYSTACK_SCRIPT_SRC}"]`
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Paystack.")),
          { once: true }
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
 * Complete an already initialized order payment.
 *
 * The backend creates the Paystack transaction and returns its accessCode.
 * InlineJS resumeTransaction() then opens the checkout for that exact
 * transaction. On successful completion, the reference is sent back to
 * Ehral's backend for server-side Paystack verification.
 *
 * The frontend never marks an order as paid by itself.
 *
 * @param {number} orderId
 * @param {{onClose?: () => void, onPending?: () => void}} [options]
 * @returns {Promise<{status:string, orderStatus:string, reference:string}>}
 */
export async function payForOrderOnline(orderId, { onClose, onPending } = {}) {
  if (!orderId) {
    throw new Error("A valid order is required before starting payment.");
  }

  const init = await initializeOrderPayment(orderId);

  if (!init?.accessCode) {
    throw new Error(
      "Paystack did not return a payment access code. The transaction could not be opened."
    );
  }

  await loadPaystackScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    let successCallbackStarted = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    try {
      const popup = new window.PaystackPop();

      popup.resumeTransaction(init.accessCode, {
        onSuccess: async (transaction) => {
          successCallbackStarted = true;

          const reference =
            transaction?.reference ||
            transaction?.trxref ||
            init.reference;

          if (!reference) {
            finish(
              reject,
              new Error(
                "Paystack completed the transaction but did not return a payment reference."
              )
            );
            return;
          }

          try {
            // This call verifies the reference against Paystack on the
            // server. The client-side onSuccess callback alone is never
            // treated as proof that money was received.
            const result = await verifyOrderPayment(
              orderId,
              reference
            );

            finish(resolve, result);
          } catch (error) {
            finish(reject, error);
          }
        },

        onCancel: () => {
          if (successCallbackStarted) return;

          onClose?.();

          finish(
            reject,
            new Error(
              "Payment window closed before payment was completed."
            )
          );
        },

        onError: (error) => {
          finish(
            reject,
            new Error(
              error?.message ||
                "Paystack could not open the payment checkout."
            )
          );
        },

        // Bank-transfer flows can remain pending until Paystack confirms
        // the transfer. Pending is not success, so leave the order pending
        // and let the backend webhook/verification finalize it.
        onBankTransferConfirmationPending: () => {
          onPending?.();
        },
      });
    } catch (error) {
      finish(reject, error);
    }
  });
}