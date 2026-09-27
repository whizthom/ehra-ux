import API from "./authApi";

// ── Attendance settings (Dynamic/Static QR + Attendance Zone) ──────────────
// Powers the "Settings" view on the QR Code nav tab.
export const getAttendanceSettings = () => API.get("/business/attendance-settings");

export const updateAttendanceSettings = (data) =>
  API.put("/business/attendance-settings", data);

export const regenerateStaticQr = () =>
  API.post("/business/attendance-settings/regenerate-static-qr");
