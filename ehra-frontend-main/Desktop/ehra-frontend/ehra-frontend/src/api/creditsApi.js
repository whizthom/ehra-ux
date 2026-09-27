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