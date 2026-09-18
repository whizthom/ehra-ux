import API from "./authApi";

export const getInventory = () =>
  API.get("/retail/inventory");

export const getStockMovements = () =>
  API.get("/retail/inventory/movements");

export const getMovementHistory = (params = {}) =>
  API.get("/retail/inventory/movements/history", {
    params,
  });

export const adjustStock = (data) =>
  API.post("/retail/inventory/adjust", data);

export const getLowStockProducts = () =>
  API.get("/retail/inventory/low-stock");

export const getInventorySummary = () =>
  API.get("/retail/inventory/summary");

export const getProductStock = (productId) =>
  API.get(`/retail/inventory/products/${productId}`);

export const updateProductStock = (productId, data) =>
  API.put(`/retail/inventory/products/${productId}`, data);