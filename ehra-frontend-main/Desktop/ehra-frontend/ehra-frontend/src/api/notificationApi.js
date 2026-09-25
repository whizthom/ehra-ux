import API from "./authApi";

// ── Admin (business-scoped) ───────────────────────────────────────────────────
export const getNotifications = () => API.get("/notifications");
export const getUnreadCount = () => API.get("/notifications/unread-count");
export const markAllRead = () => API.put("/notifications/read-all");

// ── Admin broadcast ────────────────────────────────────────────────────────────
export const broadcastMessage = (data) => API.post("/notifications/broadcast", data);
// data shape: { title?: string, message: string }

// ── Employee (own notifications) ──────────────────────────────────────────────
export const getMyNotifications = () => API.get("/notifications/me");
export const getMyUnreadCount = () => API.get("/notifications/me/unread-count");
export const markAllReadForMe = () => API.put("/notifications/me/read-all");

// ── Shared - mark one notification read, works for admin or employee ─────────
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);

// ── Shared - permanently delete one notification, works for admin or employee ─
// Callers should hold this behind a brief "Undo" window rather than firing it
// the instant the user clicks delete.
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);

// ── Announcements (Messages) - Admin ─────────────────────────────────────────
export const sendAnnouncement = (data) => API.post("/announcements", data);
// data shape: { subject: string, body: string, recipientEmployeeId?: number }

export const getAllAnnouncements = () => API.get("/announcements");
export const deleteAnnouncement = (id) => API.delete(`/announcements/${id}`);

// ── Announcements (Messages) - Employee ──────────────────────────────────────
export const getMyAnnouncements = () => API.get("/announcements/me");
export const markAnnouncementRead = (id) => API.put(`/announcements/${id}/read`);

// ── Retail workspace ────────────────────────────────────────────────────────
export const getRetailNotifications = () => API.get("/notifications/retail");
export const getRetailUnreadCount = () => API.get("/notifications/retail/unread-count");
export const markAllRetailRead = () => API.put("/notifications/retail/read-all");

// ── Customer-owned notifications ────────────────────────────────────────────
export const getCustomerNotifications = () => API.get("/notifications/customer");
export const getCustomerUnreadCount = () => API.get("/notifications/customer/unread-count");
export const markAllCustomerRead = () => API.put("/notifications/customer/read-all");
