import API from "./authApi";

// All routed through the shared `API` instance (relative "/api" + Vite
// proxy) instead of a hardcoded "http://localhost:8080" — this is what
// makes the invite flow work from any device on the LAN (e.g. a phone
// scanning a QR-shared invite link) and over the app's https dev server,
// not just from the machine running the backend.

// GET /api/invitations/{token} — public, no auth required.
export const validateInvitation = (token) =>
  API.get(`/invitations/${token}`).then((r) => r.data);

// POST /api/invitations/generate — employer-only, generates a fresh
// invite link for their business.
export const generateInvitation = () =>
  API.post("/invitations/generate").then((r) => r.data);

// POST /api/invitations/register — public sign-up form for someone with
// NO existing Ehra account. Creates a brand-new Identity + a
// PENDING_APPROVAL EmployeeMembership at the inviting business.
export const registerInvitedEmployee = (payload) =>
  API.post("/invitations/register", payload).then((r) => r.data);

// POST /api/invitations/{token}/accept — the "already logged in" path,
// for an Identity that already has an Ehra account (an existing employer
// picking up part-time work elsewhere, or any existing employee/owner
// invited to a second business) to attach a new PENDING_APPROVAL
// EmployeeMembership to their EXISTING Identity. Requires auth; never
// switches the session's active context — the new membership just shows
// up in the next getMyAccounts() call.
export const acceptInvitation = (token) =>
  API.post(`/invitations/${token}/accept`).then((r) => r.data);
