import API from "./authApi";
export const getProducts = (includeInactive=false) => API.get("/products", { params:{ includeInactive } });
export const createProduct = (data) => API.post("/products", data);
export const updateProduct = (id,data) => API.put(`/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getStorefront = () => API.get("/business/storefront");
export const saveStorefront = (data) => API.put("/business/storefront", data);
export const getOrders = () => API.get("/orders");
export const getOrder = (id) => API.get(`/orders/${id}`);
export const updateOrderStatus = (id,status) => API.patch(`/orders/${id}/status`, { status });
export const getOrderWhatsApp = (id) => API.get(`/orders/${id}/whatsapp`);
export const getCustomers = () => API.get("/customers");
export const getPublicStorefront = (slug) => API.get(`/storefronts/${encodeURIComponent(slug)}`);
export const getPublicProducts = (slug) => API.get(`/public/storefronts/${encodeURIComponent(slug)}/products`);
export const createPublicOrder = (slug,data) => API.post(`/public/storefronts/${encodeURIComponent(slug)}/orders`, data);

export const uploadProductImage=file=>{const f=new FormData();f.append("file",file);return API.post("/products/images",f,{headers:{"Content-Type":"multipart/form-data"}})}; export const uploadStorefrontCover=file=>{const f=new FormData();f.append("file",file);return API.post("/business/storefront/cover-image",f,{headers:{"Content-Type":"multipart/form-data"}})}; export const createCustomer=d=>API.post("/customers",d); export const updateCustomer=(id,d)=>API.put(`/customers/${id}`,d); export const deleteCustomer=id=>API.delete(`/customers/${id}`);
export const claimStorefrontCustomer=(slug,phoneVerificationToken)=>API.post(`/public/storefronts/${encodeURIComponent(slug)}/customer/claim`,null,{params:{phoneVerificationToken}});

export const getCustomerOrders = () => API.get("/customer/orders");

export const getCustomerOverview = () => API.get("/customer/overview");
export const connectCustomerToBusiness = (businessSlug) => API.post(`/customer/connect/${encodeURIComponent(businessSlug)}`);
export const getCustomerReceiptPdf = (orderId) => API.get(`/customer/orders/${orderId}/receipt`, { responseType: "blob" });
