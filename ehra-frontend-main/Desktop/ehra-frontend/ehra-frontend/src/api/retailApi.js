import API from './authApi';
export const getExpenses=()=>API.get('/retail/expenses'); export const addExpense=d=>API.post('/retail/expenses',d); export const updateExpense=(id,d)=>API.put(`/retail/expenses/${id}`,d); export const deleteExpense=id=>API.delete(`/retail/expenses/${id}`);
export const getSuppliers=()=>API.get('/retail/suppliers'); export const addSupplier=d=>API.post('/retail/suppliers',d); export const updateSupplier=(id,d)=>API.put(`/retail/suppliers/${id}`,d); export const deleteSupplier=id=>API.delete(`/retail/suppliers/${id}`);
export const getMovements=()=>API.get('/retail/inventory/movements'); export const adjustStock=(id,type,quantity,note)=>API.post(`/retail/inventory/${id}/adjust`,null,{params:{type,quantity,note}});
export const getSales=()=>API.get('/retail/sales'); export const createSale=d=>API.post('/retail/sales',d); export const refundSale=id=>API.post(`/retail/sales/${id}/refund`); export const getPurchases=()=>API.get('/retail/purchases'); export const createPurchase=d=>API.post('/retail/purchases',d); export const reversePurchase=id=>API.post(`/retail/purchases/${id}/reverse`); export const getReport=(from,to)=>API.get('/retail/reports',{params:{from,to}});

export const addSalePayment=(id,d)=>API.post(`/retail/sales/${id}/payments`,d); export const getSalePayments=id=>API.get(`/retail/sales/${id}/payments`); export const refundSalePayment=(id,d)=>API.post(`/retail/sales/${id}/refund-payment`,d); export const addPurchasePayment=(id,d)=>API.post(`/retail/purchases/${id}/payments`,d); export const getPurchasePayments=id=>API.get(`/retail/purchases/${id}/payments`); export const addOrderPayment=(id,d)=>API.post(`/retail/orders/${id}/payments`,d); export const getOrderPayments=id=>API.get(`/retail/orders/${id}/payments`);
export const getRetailEmployees=()=>API.get("/retail/employees"); export const setRetailEmployeeRole=(id,role)=>API.put(`/retail/employees/${id}/role`,null,{params:{role}}); export const setRetailEmployeePermissions=(id,d)=>API.put(`/retail/employees/${id}/permissions`,d);

export const getLedger=(from,to)=>API.get("/retail/ledger",{params:{from,to}});

export const updatePaymentStatus=(id,status,reason)=>API.put(`/retail/payments/${id}/status`,null,{params:{status,reason}});

export const getRetailContext=()=>API.get("/retail/context");
export const getMovementHistory=(params={})=>API.get('/retail/inventory/movements/history',{params});

// POS "approval slip" flow: send a cart to an Ehral-account customer for
// their approval + choice of payment method before the sale is finalized.
export const createSaleApproval=d=>API.post('/retail/sales/approvals',d);
export const getSaleApprovals=(status)=>API.get('/retail/sales/approvals',{params:status?{status}:{}});
export const confirmSaleApprovalPayment=id=>API.post(`/retail/sales/approvals/${id}/confirm-payment`);
export const cancelSaleApproval=id=>API.post(`/retail/sales/approvals/${id}/cancel`);
