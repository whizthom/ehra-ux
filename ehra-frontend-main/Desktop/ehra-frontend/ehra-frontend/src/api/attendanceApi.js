import API from "./authApi";
import axios from "axios";
import { API_BASE_URL } from "./authApi";

// ── QR (admin) ──────────────────────────────────────────────────────────────
export const getCurrentQrToken = () => API.get("/attendance/qr/current");

// ── QR public display link (admin controls) ─────────────────────────────────
// Lets an employer share a link (e.g. to a reception tablet) that shows the
// live rotating QR without needing to log into the dashboard. Admin-only —
// generating/revoking requires the normal authenticated `API` instance.
export const getQrDisplayLink = () => API.get("/attendance/qr/display-link");
export const generateQrDisplayLink = () => API.post("/attendance/qr/display-link");
export const revokeQrDisplayLink = () => API.delete("/attendance/qr/display-link");

// ── QR public display link (the shared link itself) ─────────────────────────
// Called from the PUBLIC display page (see pages/QrDisplayPage.jsx) — no
// login, so this deliberately uses a bare axios call instead of the shared
// `API` instance: `API`'s interceptors assume an authenticated session (auto
// token-refresh on 401, Bearer header injection) which doesn't apply here and
// could otherwise trigger a pointless refresh attempt for someone who was
// never logged in on this device at all.
export const getCurrentQrTokenPublic = (linkToken) =>
  axios.get(`${API_BASE_URL}/attendance/qr/display/${linkToken}`);

// ── Scan (employee) ─────────────────────────────────────────────────────────
export const submitScan = (token, coords) =>
  API.post("/attendance/scan", {
    token,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  });

// ── Attendance views ─────────────────────────────────────────────────────────
export const getTodayAttendance = () => API.get("/attendance/today");
// from/to are optional — omit both (or pass undefined) to get the
// business's complete attendance history, past to present, for every
// employee. Pass both to narrow to a date range.
export const getAttendanceHistory = (from, to) =>
  API.get("/attendance/history", { params: from && to ? { from, to } : {} });
export const getMyAttendance = () => API.get("/attendance/me");

// ── Schedule (admin) ─────────────────────────────────────────────────────────
export const getWeeklySchedule = () => API.get("/schedule/weekly");
export const updateDaySchedule = (data) => API.put("/schedule/weekly", data);
// data shape: { dayOfWeek: "MONDAY", clockInTime: "09:00", clockOutTime: "17:00", enabled: true }

export const getHolidays = () => API.get("/schedule/holidays");
export const addHoliday = (data) => API.post("/schedule/holidays", data);
// data shape: { date: "2025-12-25", label: "Christmas Day" }
export const deleteHoliday = (id) => API.delete(`/schedule/holidays/${id}`);