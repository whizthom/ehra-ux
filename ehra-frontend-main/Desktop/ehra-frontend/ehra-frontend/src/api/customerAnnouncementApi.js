import API from "./authApi";

// Business -> customers announcements (one-to-many, with read receipts).
// Two audiences share this file; the backend routes them by role:
//   business side (employer / an employee the employer allowed) - send,
//   list what was sent (with read counts), open one for its receipts, delete;
//   customer side - the inbox across every business they follow, mark read,
//   reply (the reply lands in their shared chat with that business).

// ── Business side ─────────────────────────────────────────────────────
export const sendCustomerAnnouncement = ({ subject, body }) =>
  API.post("/customer-announcements", { subject, body });

export const listCustomerAnnouncements = () => API.get("/customer-announcements");

export const getCustomerAnnouncement = (id) => API.get(`/customer-announcements/${id}`);

export const deleteCustomerAnnouncement = (id) => API.delete(`/customer-announcements/${id}`);

// ── Customer side ─────────────────────────────────────────────────────
export const listMyCustomerAnnouncements = () => API.get("/customer-announcements/me");

export const getMyCustomerAnnouncementUnreadCount = () =>
  API.get("/customer-announcements/me/unread-count");

export const markCustomerAnnouncementRead = (id) => API.put(`/customer-announcements/${id}/read`);

// Resolves to { conversationId, messageId } - where the reply landed.
export const replyToCustomerAnnouncement = (id, body) =>
  API.post(`/customer-announcements/${id}/reply`, { body });
