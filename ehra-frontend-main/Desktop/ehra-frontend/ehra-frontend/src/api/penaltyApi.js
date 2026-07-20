import API from "./authApi";

// ── Settings — employer only ────────────────────────────────────────────
export const getPenaltySettings = () => API.get(`/penalty/settings`);

export const updatePenaltySettings = (payload) =>
  API.put(`/penalty/settings`, payload);

// ── Employer's business-wide overview (Tools > Penalty) ────────────────
export const getBusinessOverview = (periodEnd) =>
  API.get(`/penalty/business/overview`, { params: periodEnd ? { periodEnd } : {} });

export const getFinalizedPeriods = () => API.get(`/penalty/business/periods`);

export const finalizePayrollNow = () => API.post(`/penalty/business/finalize-now`);

// ── Single employee (employer / HOD / self — server enforces access) ───
export const getEmployeePenaltySummary = (employeeId, periodEnd) =>
  API.get(`/penalty/employees/${employeeId}/summary`, {
    params: periodEnd ? { periodEnd } : {},
  });

export const getEmployeePenaltyHistory = (employeeId) =>
  API.get(`/penalty/employees/${employeeId}/history`);

// ── Employee's own view ─────────────────────────────────────────────────
export const getMyPenaltySummary = (periodEnd) =>
  API.get(`/penalty/me`, { params: periodEnd ? { periodEnd } : {} });

export const getMyPenaltyHistory = () => API.get(`/penalty/me/history`);

// ── Pardon — employer only ──────────────────────────────────────────────
export const pardonAttendance = (attendanceId, reason) =>
  API.post(`/penalty/attendance/${attendanceId}/pardon`, { reason });

export const unpardonAttendance = (attendanceId) =>
  API.post(`/penalty/attendance/${attendanceId}/unpardon`);