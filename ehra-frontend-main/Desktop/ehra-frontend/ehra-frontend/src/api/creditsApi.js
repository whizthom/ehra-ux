import API from "./authApi";
export const getCreditsDashboard = () => API.get("/credits").then(r => r.data);

// Powers the Ehral Credits usage-history page. `params` may include:
// page, size, eventType, serviceCode, from ("yyyy-MM-dd"), to ("yyyy-MM-dd").
// Blank/undefined values are stripped rather than sent as "undefined" strings.
export const getCreditActivity = (params = {}) => {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return API.get("/credits/activity", { params: query }).then((r) => r.data);
};
export const initializeCreditPurchase = (amount) => API.post("/credits/purchases", { amount }).then(r => r.data);
export const verifyCreditPurchase = (reference) => API.post("/credits/purchases/verify", { reference }).then(r => r.data);

export const acceptCreditAgreement = () => API.post("/credits/agreement").then(r => r.data);

// ── Business Agreement (negotiated by Ops; the business can view it and pay Ops-issued payment requests) ──
export const getBusinessAgreement = () =>
  API.get("/business-agreement", { validateStatus: (s) => s === 200 || s === 204 }).then((r) => (r.status === 204 ? null : r.data));
export const initializeAgreementPayment = (paymentId) =>
  API.post(`/business-agreement/payments/${paymentId}/initialize`).then((r) => r.data);
export const verifyAgreementPayment = (reference) =>
  API.post("/business-agreement/payments/verify", { reference }).then((r) => r.data);
