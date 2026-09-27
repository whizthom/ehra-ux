import API from "./authApi";

export const getProducts = (includeInactive = false) =>
  API.get("/products", { params: { includeInactive } });

export const createProduct = (data) =>
  API.post("/products", data);

export const updateProduct = (id, data) =>
  API.put(`/products/${id}`, data);

export const deleteProduct = (id) =>
  API.delete(`/products/${id}`);

// Retries the Ehral Credits PRODUCT_ACTIVATION charge for a product that
// was saved without enough credit (or whose monthly renewal lapsed) — see
// the creditActive flag on the product returned by getProducts/createProduct.
export const activateProduct = (id) =>
  API.post(`/products/${id}/activate`);

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
  const form = new FormData();
  form.append("file", file);

  return API.post("/products/images", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const uploadStorefrontCover = (file) => {
  const form = new FormData();
  form.append("file", file);

  return API.post("/business/storefront/cover-image", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
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
    `/public/storefronts/${encodeURIComponent(
      slug
    )}/customer/claim`,
    null,
    {
      params: {
        phoneVerificationToken,
      },
    }
  );

// ── Customer detail panel: full profile, spend/profit breakdown,
// orders, loyalty coupons, and CSV/PDF export ─────────────────────

export const getCustomerDetail = (membershipId) =>
  API.get(`/customers/${membershipId}/detail`);

async function downloadCommerceBlob(url, filename) {
  const { data } = await API.get(url, {
    responseType: "blob",
  });

  const blobUrl = window.URL.createObjectURL(data);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(blobUrl);
}

export const downloadCustomerCsv = (
  membershipId,
  customerName
) =>
  downloadCommerceBlob(
    `/customers/${membershipId}/export.csv`,
    `${(customerName || "customer")
      .replace(/\s+/g, "-")
      .toLowerCase()}-statement.csv`
  );

export const downloadCustomerPdf = (
  membershipId,
  customerName
) =>
  downloadCommerceBlob(
    `/customers/${membershipId}/export.pdf`,
    `${(customerName || "customer")
      .replace(/\s+/g, "-")
      .toLowerCase()}-statement.pdf`
  );

// ── Loyalty coupons ───────────────────────────────────────────────

export const getCustomerCoupons = (membershipId) =>
  API.get(`/customers/${membershipId}/coupons`);

export const awardCustomerCoupon = (
  membershipId,
  data
) =>
  API.post(
    `/customers/${membershipId}/coupons`,
    data
  );

export const revokeCustomerCoupon = (
  membershipId,
  couponId
) =>
  API.delete(
    `/customers/${membershipId}/coupons/${couponId}`
  );

export const redeemCustomerCouponManually = (
  membershipId,
  couponId
) =>
  API.post(
    `/customers/${membershipId}/coupons/${couponId}/redeem`
  );

export const getCustomerOrders = () =>
  API.get("/customer/orders");

export const getCustomerOverview = () =>
  API.get("/customer/overview");

export const connectCustomerToBusiness = (
  businessSlug
) =>
  API.post(
    `/customer/connect/${encodeURIComponent(
      businessSlug
    )}`
  );

export const getCustomerReceiptPdf = (orderId) =>
  API.get(
    `/customer/orders/${orderId}/receipt`,
    {
      responseType: "blob",
    }
  );

// Identity-level Customer discovery and authenticated
// business view. These remain inside the My Ehral application
// and do not redirect to the public /store/{slug} experience.

export const discoverCustomerBusinesses = (
  params = {}
) =>
  API.get("/customer/discover", {
    params,
  });

export const getCustomerBusinessTypes = () =>
  API.get("/customer/discover/types");

export const getCustomerBusinessView = (
  businessId
) =>
  API.get(
    `/customer/businesses/${businessId}`
  );

export const connectCustomerToBusinessId = (
  businessId
) =>
  API.post(
    `/customer/businesses/${businessId}/connect`
  );

// Leaves a business. The link is only soft-removed on the server (orders,
// receipts and history stay in the customer's account), and calling
// connectCustomerToBusinessId again restores it - so the two together
// drive the Connect / Disconnect toggle.
export const disconnectCustomerFromBusinessId = (
  businessId
) =>
  API.delete(
    `/customer/businesses/${businessId}/connect`
  );

export const getCustomerProfile = () =>
  API.get("/customer/profile");

export const updateCustomerProfile = (data) =>
  API.put("/customer/profile", data);

// POS approval slips: carts a business sends from the counter for the
// customer to review, approve (choosing how they'll pay) or decline — and
// the premium branded receipts issued once the business confirms payment.
export const getMySalesApprovals = () => API.get("/customer/sales-approvals");
export const approveSaleApproval = (id, paymentMethod) => API.post(`/customer/sales-approvals/${id}/approve`, { paymentMethod });
export const declineSaleApproval = (id, reason) => API.post(`/customer/sales-approvals/${id}/decline`, { reason });
export const getMyPosReceipts = () => API.get("/customer/sales-approvals/receipts");
export const getMyPosReceipt = (saleId) => API.get(`/customer/sales-approvals/receipts/${saleId}`);

/**
 * Upload the customer's profile picture.
 *
 * This is the identity-level customer profile image,
 * so the uploaded image can be used anywhere the
 * customer's initials were previously displayed.
 */
export const uploadCustomerProfilePicture = (
  file
) => {
  const form = new FormData();
  form.append("file", file);

  return API.post(
    "/upload/profile-picture",
    form,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
};