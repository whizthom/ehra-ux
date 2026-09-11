import API from "./authApi";
import axios from "axios";
import { API_BASE_URL, readSession } from "./authApi";
import {
  getAttendanceDeviceContext,
  getOrCreateAttendanceKeyPair,
  signAttendanceChallenge,
  updateAttendanceDeviceId,
} from "../utils/attendanceDeviceCrypto";
import {
  enrollAttendanceDevice,
  requestAttendanceDeviceChallenge,
} from "./attendanceDeviceApi";

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
export const submitScan = (token, coords, deviceProof = {}) =>
  API.post("/attendance/scan", {
    token,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    ...deviceProof,
  }, { timeout: 20000 });

const enrollmentPromises = new Map();

function enrollmentContextKey(context) {
  return [context.identityId, context.businessId, context.membershipId].filter(Boolean).join(":");
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

function detectDeviceName() {
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/Macintosh/i.test(ua)) return "Mac browser";
  if (/Windows/i.test(ua)) return "Windows browser";
  return "Web browser";
}

export async function ensureAttendanceDevice() {
  const session = readSession();
  const context = getAttendanceDeviceContext(session);
  if (!context.membershipId) throw new Error("No active employee membership is available.");

  const key = enrollmentContextKey(context);
  if (enrollmentPromises.has(key)) return enrollmentPromises.get(key);

  const promise = (async () => {
    const stored = await getOrCreateAttendanceKeyPair(context);
    if (stored.deviceId) return { ...stored, session, context };

    const { data } = await enrollAttendanceDevice({
      publicKey: stored.publicKeyB64,
      platform: detectPlatform(),
      deviceName: detectDeviceName(),
      appVersion: import.meta.env.VITE_APP_VERSION || undefined,
    });
    await updateAttendanceDeviceId(context, data.deviceId);
    return { ...stored, deviceId: data.deviceId, session, context, device: data };
  })();

  enrollmentPromises.set(key, promise);
  try {
    return await promise;
  } finally {
    enrollmentPromises.delete(key);
  }
}

export async function buildAttendanceDeviceProof(action) {
  const session = readSession();
  const context = getAttendanceDeviceContext(session);
  if (!context.membershipId) return null;

  const stored = await getOrCreateAttendanceKeyPair(context);
  let deviceId = stored.deviceId;

  // If the attendance screen has already started enrollment, reuse that one
  // in-flight request so a very fast tap does not race the binding. If it fails
  // (for example, another device is already registered), continue immediately
  // with the public-key challenge path instead of retrying enrollment.
  if (!deviceId) {
    const enrollment = enrollmentPromises.get(enrollmentContextKey(context));
    if (enrollment) {
      try {
        const enrolled = await enrollment;
        deviceId = enrolled.deviceId;
      } catch (enrollError) {
        console.warn("Attendance device enrollment unavailable; continuing with unbound device proof.", enrollError);
      }
    }
  }

  const challengePayload = { action };
  if (deviceId) challengePayload.deviceId = deviceId;
  else challengePayload.publicKey = stored.publicKeyB64;

  const { data } = await requestAttendanceDeviceChallenge(challengePayload);
  const signature = await signAttendanceChallenge(
    stored.keyPair.privateKey,
    data.challenge,
    context.membershipId,
    action,
  );

  return {
    deviceId: data.deviceId,
    deviceChallenge: data.challenge,
    deviceSignature: signature,
  };
}

export async function submitScanWithDeviceProof(token, coords, action) {
  const requestId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let proof = null;
  try {
    proof = await buildAttendanceDeviceProof(action);
  } catch (err) {
    // Signing/challenge failure must never block attendance. Submit the same
    // scan without device fields so the backend can record and flag it.
    console.warn("Attendance device proof unavailable; submitting attendance without proof.", err);
  }

  return submitScan(token, coords, {
    ...(proof || {}),
    requestId,
  });
}

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

export function getAttendanceErrorMessage(error) {
  if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
    return "The attendance service took too long to respond. Check your connection and scan the current QR again.";
  }
  const data = error?.response?.data;
  const code = data?.errors?.code;
  if (code === "QR_EXPIRED") return "This QR code has expired. Scan the newly displayed QR code.";
  if (code === "QR_INVALID") return "This QR code is invalid. Please scan the current QR code.";
  if (code === "ATTENDANCE_COOLDOWN") return data?.message || "Attendance was just recorded. Please wait before scanning again.";
  if (code === "ATTENDANCE_LOCATION_REQUIRED") return "Location access is required to check in at this workplace.";
  if (code === "ATTENDANCE_ZONE") return "You are outside your workplace attendance zone.";
  if (code === "NOT_SCHEDULED") return data?.message || "You are not scheduled to work today.";
  if (code === "WRONG_BRANCH") return data?.message || "This QR code is for a different branch.";
  if (code === "ALREADY_COMPLETED") return "You have already completed attendance for today.";
  return data?.message || (typeof data === "string" ? data : error?.message) || "Scan failed. Please try again.";
}
