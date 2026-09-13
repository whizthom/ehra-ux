import API from "./authApi";

// ── Offline attendance ───────────────────────────────────────────────────
// Mirrors OfflineAttendanceController on the backend. Both calls require
// an authenticated employee session — there is deliberately no public/
// unauthenticated variant, unlike the QR display link endpoints.

export const getOfflineAttendanceStatus = (deviceId) =>
  API.get("/attendance/offline/status", { params: { deviceId } });

// `transactions` is the local pending queue as stored by
// offlineAttendanceJournal.js — sent in whatever order the caller
// provides; the backend re-sorts by sequence before reconciling, so
// order here doesn't need to be perfect, just complete.
export const syncOfflineAttendance = (transactions) =>
  API.post("/attendance/offline/sync", transactions, { timeout: 30000 });
