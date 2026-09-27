import API from "./authApi";

// REST layer for the real-time messaging feature (com.Ehra.messaging on
// the backend). Kept completely separate from the legacy chatApi.js
// (which still backs the old SSE-based chat) - nothing here touches that
// file or its endpoints.

// Two separate inboxes share this API, selected by `channel`:
//   "STAFF"    (default) - the original workplace messaging.
//   "CUSTOMER" - Business <-> Customer messaging (business-type workspaces
//                and the customer's own Ehral account).
// They never mix: the backend scopes every list, count and search by it.
export const CHANNEL_STAFF = "STAFF";
export const CHANNEL_CUSTOMER = "CUSTOMER";

export const listConversations = (channel = CHANNEL_STAFF) =>
  API.get("/messaging/conversations", { params: { channel } });

export const createConversation = ({ memberIdentityIds, groupName, groupAvatarUrl }) =>
  API.post("/messaging/conversations", { memberIdentityIds, groupName, groupAvatarUrl });

export const getMessages = (conversationId, { beforeId, limit = 30 } = {}) =>
  API.get(`/messaging/conversations/${conversationId}/messages`, {
    params: { beforeId, limit },
  });

export const sendMessage = (conversationId, payload) =>
  API.post(`/messaging/conversations/${conversationId}/messages`, payload);

export const editMessage = (messageId, body) =>
  API.put(`/messaging/messages/${messageId}`, { body });

export const deleteMessage = (messageId, forEveryone) =>
  API.delete(`/messaging/messages/${messageId}`, { params: { forEveryone } });

export const setReaction = (messageId, reaction) =>
  API.post(`/messaging/messages/${messageId}/reactions`, { reaction });

export const removeReaction = (messageId) =>
  API.delete(`/messaging/messages/${messageId}/reactions`);

export const markRead = (conversationId) =>
  API.post(`/messaging/conversations/${conversationId}/read`);

export const updateConversationState = (conversationId, state) =>
  API.put(`/messaging/conversations/${conversationId}/state`, state);

export const addMembers = (conversationId, identityIds) =>
  API.post(`/messaging/conversations/${conversationId}/members`, { identityIds });

export const removeMember = (conversationId, identityId) =>
  API.delete(`/messaging/conversations/${conversationId}/members/${identityId}`);

export const leaveConversation = (conversationId) =>
  API.post(`/messaging/conversations/${conversationId}/leave`);

export const listContacts = () => API.get("/messaging/contacts");

export const searchMessaging = (q, channel = CHANNEL_STAFF) =>
  API.get("/messaging/search", { params: { q, channel } });

export const getMessagingUnreadCount = (channel = CHANNEL_STAFF) =>
  API.get("/messaging/unread-count", { params: { channel } });

export const uploadAttachment = (file, kind, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind); // IMAGE | DOCUMENT | VOICE
  return API.post("/messaging/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
};
export const listCustomerConversations = () => API.get("/messaging/conversations/customer");
export const createCustomerBusinessConversation = (businessId) => API.post(`/messaging/conversations/customer/business/${businessId}`);

// Staff side (employer / an employee the employer allowed): customers
// linked to the business, for the "new message" picker.
export const listCustomerContacts = (q = "") =>
  API.get("/messaging/customer-contacts", { params: { q } });

// Staff side: open (or create) the shared thread with one customer.
export const openCustomerConversation = (customerIdentityId) =>
  API.post("/messaging/conversations/customer/open", { customerIdentityId });
