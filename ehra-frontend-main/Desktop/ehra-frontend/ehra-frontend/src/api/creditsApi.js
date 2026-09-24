import API from "./authApi";
export const getCreditsDashboard = () => API.get("/credits").then(r => r.data);
export const initializeCreditPurchase = (amount) => API.post("/credits/purchases", { amount }).then(r => r.data);
export const verifyCreditPurchase = (reference) => API.post("/credits/purchases/verify", { reference }).then(r => r.data);

export const acceptCreditAgreement = () => API.post("/credits/agreement").then(r => r.data);
