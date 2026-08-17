import API from "./authApi";

// ── Branch CRUD ──────────────────────────────────────────────────────────

export const getBranches = (status) =>
  API.get("/branches", { params: status ? { status } : {} });

export const getBranch = (id) => API.get(`/branches/${id}`);

export const createBranch = (data) => API.post("/branches", data);
// data shape: { name, code?, description?, address?, city?, state?,
//               country?, phone?, email?, managerId? }

export const updateBranch = (id, data) => API.put(`/branches/${id}`, data);
// data shape: any subset of the create fields; managerId: number | null

export const updateBranchStatus = (id, status) =>
  API.patch(`/branches/${id}/status`, { status });
// status: "ACTIVE" | "INACTIVE"

export const deleteBranch = (id) => API.delete(`/branches/${id}`);

// ── Branch dashboard, QR, employees ─────────────────────────────────────

export const getBranchDashboard = (id) => API.get(`/branches/${id}/dashboard`);

export const getBusinessBranchDashboard = () => API.get(`/branches/dashboard`);

export const getBranchEmployees = (id, page = 0, size = 25) =>
  API.get(`/branches/${id}/employees`, { params: { page, size } });

export const getBranchLeave = (id, page = 0, size = 25) =>
  API.get(`/branches/${id}/leave`, { params: { page, size } });

export const getBranchPayroll = (id, page = 0, size = 25) =>
  API.get(`/branches/${id}/payroll`, { params: { page, size } });

export const getBranchAttendanceQr = (id) => API.get(`/branches/${id}/attendance-qr`);

export const regenerateBranchAttendanceQr = (id) =>
  API.post(`/branches/${id}/attendance-qr/regenerate`);

// ── Employee branch-transfer history ────────────────────────────────────

export const getEmployeeBranchHistory = (employeeId) =>
  API.get(`/employees/${employeeId}/branch-history`);

// ── Assign an employee to a branch ──────────────────────────────────────

export const assignEmployeeBranch = (employeeId, branchId) =>
  API.put(`/employees/${employeeId}/branch`, { branchId });
// branchId can be null to unassign