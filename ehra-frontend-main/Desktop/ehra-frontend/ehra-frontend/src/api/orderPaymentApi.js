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
 * The full customer checkout in one call: initialize on the backend, open
 * the Paystack popup, then re-verify server-side once it closes - the
 * same "never trust the popup's own onSuccess" pattern
 * subscriptionApi.payWithPaystack already documents. Never marks anything
 * paid client-side; the returned status reflects the backend's own
 * verification result (which itself only trusts Paystack, not this call).
 *
 * @param {number} orderId
 * @param {() => void} [onClose] - called if the customer dismisses the
 *   popup without paying (order stays PAYMENT PENDING/FAILED).
 * @returns {Promise<{status:string, orderStatus:string, reference:string}>}
 */
export async function payForOrderOnline(orderId, { onClose } = {}) {
  const init = await initializeOrderPayment(orderId);
  return new Promise((resolve, reject) => {
    payWithPaystack({
      email: init.email,
      amountNaira: init.amount,
      reference: init.reference,
      publicKey: init.publicKey,
      onSuccess: async (reference) => {
        try {
          const result = await verifyOrderPayment(orderId, reference);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
      onClose: () => {
        onClose?.();
        reject(new Error("Payment window closed before completing."));
      },
    }).catch(reject);
  });
}
