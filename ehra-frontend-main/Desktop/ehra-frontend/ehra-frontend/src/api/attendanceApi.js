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
  API.post(
    "/attendance/scan",
    {
      token,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      ...deviceProof,
    },
    { timeout: 20000 }
  );

const proofPromises = new Map();

function proofContextKey(context) {
  return [context.businessId, context.membershipId]
    .filter(Boolean)
    .join(":");
}

/*
 * Device enrollment is intentionally NOT performed here.
 *
 * Ehral now registers a device automatically only after the employee
 * successfully presents valid cryptographic proof during attendance.
 * This prevents merely opening the attendance screen from creating a
 * registered device.
 *
 * The helper remains exported for backwards compatibility with any older
 * UI code, but it now only prepares the local cryptographic identity.
 */
export async function ensureAttendanceDevice() {
  const session = readSession();
  const context = getAttendanceDeviceContext(session);

  if (!context.membershipId) {
    throw new Error("No active employee membership is available.");
  }

  const stored = await getOrCreateAttendanceKeyPair(context);

  return {
    ...stored,
    session,
    context,
  };
}

export async function buildAttendanceDeviceProof(action) {
  const session = readSession();
  const context = getAttendanceDeviceContext(session);

  if (!context.membershipId) {
    return null;
  }

  const key = proofContextKey(context);

  if (proofPromises.has(key)) {
    return proofPromises.get(key);
  }

  const promise = (async () => {
    const stored = await getOrCreateAttendanceKeyPair(context);

    let deviceId = stored.deviceId;

    /*
     * If this browser already knows its backend device identity, use it.
     * If storage was cleared, there will be no deviceId and the public key
     * path below introduces a new cryptographic device identity.
     */
    const challengePayload = {
      action,
      ...(deviceId
        ? { deviceId }
        : {
            publicKey: stored.publicKeyB64,
          }),
    };

    const { data } =
      await requestAttendanceDeviceChallenge(challengePayload);

    /*
     * The challenge endpoint may create/resolve the backend device identity.
     * Persist the returned deviceId locally so subsequent clock-ins/outs use
     * the same backend identity without another enrollment call.
     */
    if (data.deviceId && data.deviceId !== deviceId) {
      await updateAttendanceDeviceId(context, data.deviceId);
      deviceId = data.deviceId;
    }

    const signature = await signAttendanceChallenge(
      stored.keyPair.privateKey,
      data.challenge,
      context.membershipId,
      action
    );

    return {
      deviceId: data.deviceId || deviceId,
      deviceChallenge: data.challenge,
      deviceSignature: signature,
    };
  })();

  proofPromises.set(key, promise);

  try {
    return await promise;
  } finally {
    proofPromises.delete(key);
  }
}

export async function submitScanWithDeviceProof(token, coords, action) {
  const requestId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let proof = null;

  try {
    proof = await buildAttendanceDeviceProof(action);
  } catch (err) {
    // Device proof is deliberately best-effort. Attendance must continue
    // even if secure storage, challenge creation, or signing is unavailable.
    console.warn(
      "Attendance device proof unavailable; submitting attendance without proof.",
      err
    );
  }

  return submitScan(token, coords, {
    ...(proof || {}),
    requestId,
  });
}

// ── Attendance views ─────────────────────────────────────────────────────────
export const getTodayAttendance = () =>
  API.get("/attendance/today");

// from/to are optional — omit both (or pass undefined) to get the
// business's complete attendance history, past to present, for every
// employee. Pass both to narrow to a date range.
export const getAttendanceHistory = (from, to) =>
  API.get("/attendance/history", {
    params: from && to ? { from, to } : {},
  });

export const getMyAttendance = () =>
  API.get("/attendance/me");

export const getMissingClockOuts = () =>
  API.get("/attendance/missing-clock-outs");

export const resolveMissingClockOut = (attendanceId, data) =>
  API.post(
    `/attendance/missing-clock-outs/${attendanceId}/resolve`,
    data
  );

// ── Schedule (admin) ─────────────────────────────────────────────────────────
export const getWeeklySchedule = () =>
  API.get("/schedule/weekly");

export const updateDaySchedule = (data) =>
  API.put("/schedule/weekly", data);

// data shape:
// {
//   dayOfWeek: "MONDAY",
//   clockInTime: "09:00",
//   clockOutTime: "17:00",
//   enabled: true
// }

export const getHolidays = () =>
  API.get("/schedule/holidays");

export const addHoliday = (data) =>
  API.post("/schedule/holidays", data);

// data shape:
// {
//   date: "2025-12-25",
//   label: "Christmas Day"
// }

export const deleteHoliday = (id) =>
  API.delete(`/schedule/holidays/${id}`);

export function getAttendanceErrorMessage(error) {
  if (
    axios.isAxiosError(error) &&
    error.code === "ECONNABORTED"
  ) {
    return "The attendance service took too long to respond. Check your connection and scan the current QR again.";
  }

  const data = error?.response?.data;
  const code = data?.errors?.code;

  if (code === "QR_EXPIRED") {
    return "This QR code has expired. Scan the newly displayed QR code.";
  }

  if (code === "QR_INVALID") {
    return "This QR code is invalid. Please scan the current QR code.";
  }

  if (code === "ATTENDANCE_COOLDOWN") {
    return (
      data?.message ||
      "Attendance was just recorded. Please wait before scanning again."
    );
  }

  if (code === "ATTENDANCE_LOCATION_REQUIRED") {
    return "Location access is required to check in at this workplace.";
  }

  if (code === "ATTENDANCE_ZONE") {
    return "You are outside your workplace attendance zone.";
  }

  if (code === "NOT_SCHEDULED") {
    return data?.message || "You are not scheduled to work today.";
  }

  if (code === "WRONG_BRANCH") {
    return data?.message || "This QR code is for a different branch.";
  }

  if (code === "ALREADY_COMPLETED") {
    return "You have already completed attendance for today.";
  }

  return (
    data?.message ||
    (typeof data === "string" ? data : error?.message) ||
    "Scan failed. Please try again."
  );
}