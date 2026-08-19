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

export const getBranchAttendance = (id, page = 0, size = 25) =>
  API.get(`/branches/${id}/attendance`, { params: { page, size } });

export const getBranchAttendanceQr = (id) => API.get(`/branches/${id}/attendance-qr`);

export const regenerateBranchAttendanceQr = (id) =>
  API.post(`/branches/${id}/attendance-qr/regenerate`);

// ── Branch QR display link (public, shareable) ──────────────────────────

export const getBranchQrDisplayLink = (id) =>
  API.get(`/branches/${id}/attendance-qr/display-link`);

export const generateBranchQrDisplayLink = (id) =>
  API.post(`/branches/${id}/attendance-qr/display-link`);

export const revokeBranchQrDisplayLink = (id) =>
  API.delete(`/branches/${id}/attendance-qr/display-link`);

// ── Branch attendance-zone settings ─────────────────────────────────────

export const getBranchAttendanceSettings = (id) =>
  API.get(`/branches/${id}/attendance-settings`);

export const updateBranchAttendanceSettings = (id, data) =>
  API.put(`/branches/${id}/attendance-settings`, data);
// data shape: { zoneEnabled: boolean | null, latitude?, longitude?, radiusMeters? }

// ── Employee branch-transfer history ────────────────────────────────────

export const getEmployeeBranchHistory = (employeeId) =>
  API.get(`/employees/${employeeId}/branch-history`);

// ── Assign an employee to a branch ──────────────────────────────────────

export const assignEmployeeBranch = (employeeId, branchId) =>
  API.put(`/employees/${employeeId}/branch`, { branchId });
// branchId can be null to unassign