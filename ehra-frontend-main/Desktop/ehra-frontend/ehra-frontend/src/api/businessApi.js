// import axios from "axios";

// const API = axios.create({
//   baseURL: "http://localhost:8080/api"
// });

// export const registerBusiness = (data) => {
//   return API.post("/business/register", data);
// };

import API from "./authApi";

export const registerBusiness = (data) => API.post("/business/register", data);
export const completeProfile  = (data) => API.post("/business/complete-profile", data);

// ── "My Accounts" — create a business under an ALREADY-authenticated
// Identity ─────────────────────────────────────────────────────────────
// Used by the "Create a business" option in the My Accounts nav — for an
// existing employee going into business for themselves, or an existing
// owner adding a second business. Unlike registerBusiness/completeProfile
// (the public sign-up funnel, which creates a brand-new Identity), this
// never creates a password or a new Identity — only a Business + the
// EmployerMembership linking it to the caller's existing account. The
// backend auto-switches the session into the new business on success and
// returns a fresh AuthResponseDTO (tokens included).
export const addBusiness = (data) => API.post("/business", data).then((r) => r.data);

// ── Business (company) profile ──────────────────────────────────────────
// Employer-only. Applied immediately — no approval chain, unlike an
// employee's supervised profile-edit fields.
export const getMyBusinessProfile     = ()     => API.get("/business/me");
export const updateBusinessProfile    = (data) => API.put("/business/me", data);

export const uploadBusinessLogo = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/upload/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Personal attendance profile ─────────────────────────────────────────
// Employer-only. Off by default — see Settings > Personal attendance
// profile. Toggling this on makes the employer's own account count as
// staff and puts them on the same clock-in/out schedule as employees.
export const getAttendanceProfileSetting = () =>
  API.get("/business/attendance-profile");
export const updateAttendanceProfileSetting = (enabled) =>
  API.put("/business/attendance-profile", { attendanceProfileEnabled: enabled });