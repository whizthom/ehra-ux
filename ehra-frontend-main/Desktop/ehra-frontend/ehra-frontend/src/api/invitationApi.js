import API, { saveSession } from "./authApi";

// All routed through the shared `API` instance (relative "/api" + Vite
// proxy) instead of a hardcoded "http://localhost:8080" — this is what
// makes the invite flow work from any device on the LAN (e.g. a phone
// scanning a QR-shared invite link) and over the app's https dev server,
// not just from the machine running the backend.

// GET /api/invitations/{token} — public, no auth required. This is very
// often the very FIRST request of a session (someone lands here straight
// from an email/WhatsApp link) — given a longer timeout than the shared
// instance's default 15s so an ordinary slow network doesn't get
// misread by the caller as "this invitation doesn't exist." (Railway's
// Hobby plan runs 24/7 by default and does NOT cold-start unless the
// "Serverless"/App-Sleeping toggle is explicitly enabled on the backend
// service — worth double-checking that toggle is off in Railway's
// dashboard if this call is ever slow to fail.)
export const validateInvitation = (token) =>
  API.get(`/invitations/${token}`, { timeout: 45000 }).then((r) => r.data);

// POST /api/invitations/generate — employer-only. multiUse=false (the
// default) generates today's single-use link; multiUse=true generates
// the reusable "share with everyone" link instead — see the Invite
// Employee modal's "Multi-use link" tab.
export const generateInvitation = (multiUse = false) =>
  API.post("/invitations/generate", { multiUse }).then((r) => r.data);

// POST /api/invitations/bulk — the Invite Employee modal's "Invite by
// email" tab. `emails` is the raw text exactly as pasted
// (comma/newline/semicolon-separated) — parsing happens server-side.
// Creates one individually-bound single-use invite per valid address and
// emails each recipient automatically; returns which addresses were sent
// to versus skipped (and why), plus a batchId for #getInvitationBatch.
export const sendBulkInvitations = (emails) =>
  API.post("/invitations/bulk", { emails }).then((r) => r.data);

// GET /api/invitations/batch/{batchId} — lets the employer come back
// later and see who from a bulk email-invite has actually registered.
export const getInvitationBatch = (batchId) =>
  API.get(`/invitations/batch/${batchId}`).then((r) => r.data);

// POST /api/invitations/register — public sign-up form for someone with
// NO existing Ehra account. idToken is a phoneVerificationToken from the
// Termii OTP verification step (see EmployeeRegistration.jsx's phone/OTP
// steps), re-verified server-side — never a plain client-supplied phone
// field. Creates a
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