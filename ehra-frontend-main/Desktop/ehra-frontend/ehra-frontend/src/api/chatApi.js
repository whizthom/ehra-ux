import API from "./authApi";

// ── Contact lists ──────────────────────────────────────────────────────────
// Admin: every active employee, merged with any existing thread.
export const getEmployerContacts = () => API.get("/chats");
// Employee/HOD: employer thread always, HOD thread if applicable, team
// threads if the caller is an HOD.
export const getMyContacts = () => API.get("/chats/me");

// ── Thread ─────────────────────────────────────────────────────────────────
// `withKey` is "employer" or an EmployeeMembership id — whatever the
// contact list gave back as withKey for that row.
export const getThread = (withKey) => API.get(`/chats/thread/${withKey}`);
export const sendChatMessage = (withKey, body) =>
  API.post(`/chats/thread/${withKey}/messages`, { body });

// ── Badge ──────────────────────────────────────────────────────────────────
export const getChatUnreadCount = () => API.get("/chats/unread-count");