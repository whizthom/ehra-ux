import API, { saveSession } from "./authApi";

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
// NO existing Ehra account. idToken is a Firebase phone verification
// (see EmployeeRegistration.jsx's phone/OTP steps), re-verified
// server-side — never a plain client-supplied phone field. Creates a
// brand-new Identity + a PENDING_APPROVAL EmployeeMembership at the
// inviting business, and logs the person straight in (same
// AuthResponseDTO shape as login()/registerWithPhone()) — no separate
// login step, and no email is sent about any of this.
export const registerInvitedEmployee = async (payload) => {
  const { data } = await API.post("/invitations/register", payload);
  saveSession(data);
  return data;
};

// POST /api/invitations/{token}/accept — the "already logged in" path,
// for an Identity that already has an Ehra account (an existing employer
// picking up part-time work elsewhere, or any existing employee/owner
// invited to a second business) to attach a new PENDING_APPROVAL
// EmployeeMembership to their EXISTING Identity. Requires auth; never
// switches the session's active context — the new membership just shows
// up in the next getMyAccounts() call.
export const acceptInvitation = (token) =>
  API.post(`/invitations/${token}/accept`).then((r) => r.data);