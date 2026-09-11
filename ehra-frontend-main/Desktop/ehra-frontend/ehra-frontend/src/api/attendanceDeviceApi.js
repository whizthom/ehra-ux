import API from "./authApi";

export const enrollAttendanceDevice = (data) =>
  API.post("/attendance/device/enroll", data);

export const requestAttendanceDeviceChallenge = (data) =>
  API.post("/attendance/device/challenge", data);

export const getMyAttendanceDevice = () => API.get("/attendance/device/me");

export const revokeMyAttendanceDevice = () =>
  API.post("/attendance/device/revoke");

export const getBusinessAttendanceDevices = () =>
  API.get("/attendance/device/business/devices");

export const revokeBusinessAttendanceDevice = (membershipId) =>
  API.post(`/attendance/device/business/${membershipId}/revoke`);

export const getAttendanceSecurityEvents = () =>
  API.get("/attendance/device/security-events");

export const resolveAttendanceSecurityEvent = (id, resolutionNote = "") =>
  API.post(`/attendance/device/security-events/${id}/resolve`, {
    resolutionNote: resolutionNote || null,
  });
