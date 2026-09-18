import API from "./authApi";

export const getProducts = (includeInactive = false) =>
  API.get("/products", { params: { includeInactive } });

export const createProduct = (data) =>
  API.post("/products", data);

export const updateProduct = (id, data) =>
  API.put(`/products/${id}`, data);

export const deleteProduct = (id) =>
  API.delete(`/products/${id}`);

export const getStorefront = () =>
  API.get("/business/storefront");

export const saveStorefront = (data) =>
  API.put("/business/storefront", data);

export const getStorefrontSlugAvailability = (slug) =>
  API.get("/business/storefront/slug-availability", {
    params: { slug },
  });

export const getOrders = () =>
  API.get("/orders");

export const getOrder = (id) =>
  API.get(`/orders/${id}`);

export const updateOrderStatus = (id, status) =>
  API.patch(`/orders/${id}/status`, { status });

export const getOrderWhatsApp = (id) =>
  API.get(`/orders/${id}/whatsapp`);

export const getCustomers = () =>
  API.get("/customers");

export const getPublicStorefront = (slug) =>
  API.get(`/storefronts/${encodeURIComponent(slug)}`);

export const getPublicProducts = (slug) =>
  API.get(
    `/public/storefronts/${encodeURIComponent(slug)}/products`
  );

export const createPublicOrder = (slug, data) =>
  API.post(
    `/public/storefronts/${encodeURIComponent(slug)}/orders`,
    data
  );

export const uploadProductImage = (file) => {
  const formData = new FormData();
  formData.append("file", file);

  return API.post("/products/images", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const uploadStorefrontCover = (file) => {
  const formData = new FormData();
  formData.append("file", file);

  return API.post(
    "/business/storefront/cover-image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
};

export const createCustomer = (data) =>
  API.post("/customers", data);

export const updateCustomer = (id, data) =>
  API.put(`/customers/${id}`, data);

export const deleteCustomer = (id) =>
  API.delete(`/customers/${id}`);

export const claimStorefrontCustomer = (
  slug,
  phoneVerificationToken
) =>
  API.post(
    `/public/storefronts/${encodeURIComponent(slug)}/customer/claim`,
    null,
    {
      params: {
        phoneVerificationToken,
      },
    }
  );

export const getCustomerOrders = () =>
  API.get("/customer/orders");