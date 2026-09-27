import API from "./authApi";

// ── Employee ──────────────────────────────────────────────────────────────────

/** Submit a new leave request
 *  body: { leaveType, startDate, endDate, reason, coverPersonId? }
 */
export const requestLeave       = (data)         => API.post("/leave", data);
export const getMyLeaves        = ()             => API.get("/leave/me");
export const getMyCoverRequests = ()             => API.get("/leave/me/cover");
export const getMyBalances      = ()             => API.get("/leave/me/balances");
export const cancelLeave        = (id)           => API.delete(`/leave/${id}`);

// ── Cover person ──────────────────────────────────────────────────────────────

/** Respond to a cover request
 *  body: { accepted: boolean, note?: string }
 */
export const respondToCover = (id, data) => API.post(`/leave/${id}/cover-response`, data);

// ── HOD ───────────────────────────────────────────────────────────────────────

export const getDepartmentLeaves    = ()    => API.get("/leave/department");
export const getPendingHodDecisions = ()    => API.get("/leave/department/pending");
export const getCurrentlyOnLeaveForHod = () => API.get("/leave/department/on-leave");

/** HOD approves or rejects
 *  body: { approved: boolean, note?: string }
 */
export const hodDecide = (id, data) => API.post(`/leave/${id}/hod-decision`, data);

// ── Employer ──────────────────────────────────────────────────────────────────

export const getBusinessLeaves          = ()           => API.get("/leave");
export const getCurrentlyOnLeaveForBusiness = ()        => API.get("/leave/on-leave");
export const getPendingEmployerDecisions = ()          => API.get("/leave/pending");
export const approveLeave               = (id, note)   =>
    API.post(`/leave/${id}/approve`, note ? { adminNote: note } : {});
export const rejectLeave                = (id, note)   =>
    API.post(`/leave/${id}/reject`,  note ? { adminNote: note } : {});

// ── Policies (employer) ───────────────────────────────────────────────────────

export const getLeavePolicies    = ()           => API.get("/leave/policies");

/** Update a leave type policy
 *  body: { active, maxDaysPerYear, requiresCover, requiresHod }
 */
export const updateLeavePolicy   = (id, data)  => API.put(`/leave/policies/${id}`, data);

// ── Balances ──────────────────────────────────────────────────────────────────

export const getBusinessBalances  = (year)           => API.get(`/leave/balances?year=${year || ""}`);
export const getEmployeeBalances  = (empId, year)    => API.get(`/leave/balances/${empId}?year=${year || ""}`);