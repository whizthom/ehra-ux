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

// ── Assign an employee to a branch ──────────────────────────────────────

export const assignEmployeeBranch = (employeeId, branchId) =>
  API.put(`/employees/${employeeId}/branch`, { branchId });
// branchId can be null to unassign