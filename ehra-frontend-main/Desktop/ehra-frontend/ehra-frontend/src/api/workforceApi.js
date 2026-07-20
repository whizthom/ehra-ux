import API from "./authApi";

// ── Employee profiles ──────────────────────────────────────────────────────
export const getEmployeeProfile = (id) => API.get(`/employees/${id}/profile`);
export const softDeleteEmployee = (id) => API.post(`/employees/${id}/soft-delete`);
export const restoreEmployee    = (id) => API.post(`/employees/${id}/restore`);
export const getTrashedEmployees = ()  => API.get("/employees/trashed");

// ── Announcements ──────────────────────────────────────────────────────────
export const sendAnnouncement    = (data)   => API.post("/announcements", data);
export const getAllAnnouncements  = ()       => API.get("/announcements");
export const getMyAnnouncements  = ()       => API.get("/announcements/me");
export const markAnnouncementRead = (id)    => API.put(`/announcements/${id}/read`);

// ── File upload ────────────────────────────────────────────────────────────
export const uploadProfilePicture = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/upload/profile-picture", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadIdCard = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/upload/id-card", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};