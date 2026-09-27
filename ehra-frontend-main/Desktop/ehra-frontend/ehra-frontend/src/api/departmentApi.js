import API from "./authApi";

// ── Department CRUD ─────────────────────────────────────────────────────────

export const getDepartments = () => API.get("/departments");

export const createDepartment = (data) => API.post("/departments", data);
// data shape: { name: string, hodId?: number }

export const updateDepartment = (id, data) => API.put(`/departments/${id}`, data);
// data shape: { name?: string, hodId?: number | null }

export const deleteDepartment = (id) => API.delete(`/departments/${id}`);

// ── Assign an employee to a department ──────────────────────────────────────

export const assignEmployeeDepartment = (employeeId, departmentId) =>
  API.put(`/employees/${employeeId}/department`, { departmentId });
// departmentId can be null to unassign