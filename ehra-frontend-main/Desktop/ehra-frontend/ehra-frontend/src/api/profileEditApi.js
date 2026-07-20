import API from "./authApi";

// ── Employee ──────────────────────────────────────────────────────────────
export const submitProfileEdit      = (data)  => API.post("/profile-edits", data);
export const getMyProfileEdits      = ()      => API.get("/profile-edits/me");
export const cancelProfileEdit      = (id)    => API.delete(`/profile-edits/${id}`);

// ── HOD ───────────────────────────────────────────────────────────────────
export const getHodPendingEdits     = ()      => API.get("/profile-edits/hod/pending");
export const submitHodDecision      = (id, d) => API.post(`/profile-edits/${id}/hod-decision`, d);

// ── Employer ──────────────────────────────────────────────────────────────
export const getAllProfileEdits      = ()      => API.get("/profile-edits");
export const getPendingProfileEdits  = ()      => API.get("/profile-edits/pending");
export const submitEmployerDecision  = (id, d) => API.post(`/profile-edits/${id}/employer-decision`, d);

// ── Direct position assignment ───────────────────────────────────────────
// Employer: applied immediately.
export const assignPositionByEmployer = (employeeId, position) =>
  API.put(`/profile-edits/position/${employeeId}`, { position });
// HOD: creates a request that needs employer approval.
export const assignPositionByHod = (employeeId, position) =>
  API.put(`/profile-edits/position/${employeeId}/hod-assign`, { position });

// ── Direct hire date assignment ──────────────────────────────────────────
// Never available to the employee — only the employer (applied immediately)
// or the employee's HOD (creates a request that needs employer approval).
export const assignHireDateByEmployer = (employeeId, hireDate) =>
  API.put(`/profile-edits/hire-date/${employeeId}`, { hireDate });
export const assignHireDateByHod = (employeeId, hireDate) =>
  API.put(`/profile-edits/hire-date/${employeeId}/hod-assign`, { hireDate });