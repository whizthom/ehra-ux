import API from "./authApi";

// ── Employment type + part-time schedule ───────────────────────────────────
// Reachable by the Employer (for any employee) or an employee's HOD (for
// employees in their own department, except a fellow HOD — see backend
// EmploymentSettingsServiceImpl for the exact rule). The server is always
// the source of truth for permission; the frontend only mirrors it for UX.

export const getEmploymentSettings = (employeeId) =>
  API.get(`/employees/${employeeId}/employment-settings`);

export const updateEmploymentType = (employeeId, employmentType) =>
  API.put(`/employees/${employeeId}/employment-type`, { employmentType });

export const updateEmploymentSchedule = (employeeId, dayPayload) =>
  API.put(`/employees/${employeeId}/employment-schedule`, dayPayload);

// ── Position (job title) — immediate effect ─────────────────────────────
// Used by the profile page's "Edit Profile" tab. Unlike PositionCell /
// profileEditApi's position endpoints, this always applies right away for
// both the employer and an HOD — no approval queue. Same "can't edit a
// fellow HOD" rule as the employment type/schedule endpoints above.
export const updateEmployeePosition = (employeeId, position) =>
  API.put(`/employees/${employeeId}/position`, { position });

// ── Salary — employer only, immediate effect ────────────────────────────
// Only the employer can view or set this (never an HOD). The employee is
// notified right away that their salary was increased, decreased, or set
// for the first time — see EmployeeManagementServiceImpl.updateSalary.
export const updateEmployeeSalary = (employeeId, salary) =>
  API.put(`/employees/${employeeId}/salary`, { salary });