import API from "./authApi";

// ── QR (admin) ──────────────────────────────────────────────────────────────
export const getCurrentQrToken = () => API.get("/attendance/qr/current");

// ── Scan (employee) ─────────────────────────────────────────────────────────
export const submitScan = (token, coords) =>
  API.post("/attendance/scan", {
    token,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  });

// ── Attendance views ─────────────────────────────────────────────────────────
export const getTodayAttendance = () => API.get("/attendance/today");
export const getAttendanceHistory = (from, to) =>
  API.get("/attendance/history", { params: { from, to } });
export const getMyAttendance = () => API.get("/attendance/me");

// ── Schedule (admin) ─────────────────────────────────────────────────────────
export const getWeeklySchedule = () => API.get("/schedule/weekly");
export const updateDaySchedule = (data) => API.put("/schedule/weekly", data);
// data shape: { dayOfWeek: "MONDAY", clockInTime: "09:00", clockOutTime: "17:00", enabled: true }

export const getHolidays = () => API.get("/schedule/holidays");
export const addHoliday = (data) => API.post("/schedule/holidays", data);
// data shape: { date: "2025-12-25", label: "Christmas Day" }
export const deleteHoliday = (id) => API.delete(`/schedule/holidays/${id}`);