import API from "./authApi";

// Talks to com.Ehra.support.controller.SupportEntryController on the
// backend — the customer-facing half of the Support Inbox (the staff
// half lives entirely in the separate Ops Console app). Uses the same
// tenant JWT auth as every other API file here (see API's own
// interceptors in authApi.js); no new auth mechanism.

/** Start a new support conversation.
 *  body: { subject, message, categoryName?, businessId?, branchId? }
 */
export const createConversation = (data) => API.post("/support/conversations", data);

/** The signed-in identity's own conversation history, most recent first. */
export const getMyConversations = () => API.get("/support/conversations");

/** Paginated messages for one of the identity's own conversations —
 *  PUBLIC only; internal staff notes are never returned here. */
export const getConversationMessages = (id, page = 0, size = 50) =>
  API.get(`/support/conversations/${id}/messages`, { params: { page, size } });

/** Reply within an existing conversation. */
export const sendConversationMessage = (id, content) =>
  API.post(`/support/conversations/${id}/messages`, { content });