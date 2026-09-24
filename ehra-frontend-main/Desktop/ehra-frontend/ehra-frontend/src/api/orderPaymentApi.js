import API from "./authApi";
import { payWithPaystack } from "./subscriptionApi";

// ── Business: Online Ordering payment setup & reporting ─────────────────────
// Backend: com.Ehra.payments.controller.BusinessOrderPaymentController
// (/api/business/order-payments/**). Separate from Ehral's own
// subscription billing (subscriptionApi.js) - this is the "customer pays
// the business, Ehral takes a 0.1% cut" flow.

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

// The one call that actually turns online payments on. The backend
// independently re-verifies termsAccepted/termsVersion - disabling the
// button on the frontend is a UX nicety, never the real gate.
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

/**
 * Complete customer payment for an existing order.
 *
 * IMPORTANT:
 * The transaction is initialized by the Ehral backend first.
 * Paystack returns an accessCode for that exact transaction.
 * The frontend then resumes that transaction with Paystack rather
 * than creating a second transaction in the browser.
 *
 * The backend remains the authority for payment confirmation.
 */
export async function payForOrderOnline(orderId, { onClose } = {}) {
  const init = await initializeOrderPayment(orderId);

  if (!init?.accessCode) {
    throw new Error(
      "Paystack did not return a payment access code."
    );
  }

  /*
   * Paystack Popup V2 is loaded by the application's existing
   * Paystack integration. We use the access code returned by the
   * server-side initialization to resume the exact transaction.
   */
  if (!window.PaystackPop) {
    throw new Error(
      "Paystack payment system is not available. Please try again."
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const popup = new window.PaystackPop();

      popup.resumeTransaction(init.accessCode, {
        onSuccess: async (transaction) => {
          try {
            const reference =
              transaction?.reference || init.reference;

            if (!reference) {
              throw new Error(
                "Paystack did not return a transaction reference."
              );
            }

            /*
             * Never mark the order paid from the browser callback.
             * The backend verifies the transaction directly with
             * Paystack before changing the order payment status.
             */
            const result = await verifyOrderPayment(
              orderId,
              reference
            );

            resolve(result);
          } catch (err) {
            reject(err);
          }
        },

        onCancel: () => {
          if (typeof onClose === "function") {
            onClose();
          }

          reject(
            new Error(
              "Payment window closed before completing."
            )
          );
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}