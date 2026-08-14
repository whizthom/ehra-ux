import API from "./authApi";

// REST layer for the real-time messaging feature (com.Ehra.messaging on
// the backend). Kept completely separate from the legacy chatApi.js
// (which still backs the old SSE-based chat) — nothing here touches that
// file or its endpoints.

export const listConversations = () => API.get("/messaging/conversations");

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

export const searchMessaging = (q) => API.get("/messaging/search", { params: { q } });

export const getMessagingUnreadCount = () => API.get("/messaging/unread-count");

export const uploadAttachment = (file, kind, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind); // IMAGE | DOCUMENT | VOICE
  return API.post("/messaging/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
};