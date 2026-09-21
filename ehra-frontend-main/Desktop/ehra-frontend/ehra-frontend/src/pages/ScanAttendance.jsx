import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import {
  getMyAttendance,
  submitScan,
  submitScanWithDeviceProof,
  getAttendanceErrorMessage,
} from "../api/attendanceApi";
import { getMyProfile } from "../api/employeeApi";
import { useAuth } from "../context/AuthContext";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import MobileNavHub from "../components/MobileNavHub";
import useStaffNavBadges from "../hooks/useStaffNavBadges";
import dash from "./Dashboard.module.css";
import styles from "./ScanAttendance.module.css";
import { readSession } from "../api/authApi";
import {
  formatAttendanceCooldown,
  getAttendanceCooldownRemaining,
  startAttendanceCooldown,
} from "../utils/attendanceCooldown";
import {
  captureOfflineAuthorization,
  getLocalOfflineAvailability,
  getPendingOfflineCount,
  nextOfflineAction,
  recordOfflineAttendance,
  setCachedTodayState,
  syncPendingOfflineAttendance,
} from "../services/offlineAttendanceService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

// This page reuses the exact same shell (sidebar, topbar, mobile bottom
// nav) as Dashboard.jsx / EmployeeDashboard.jsx via Dashboard.module.css,
// so a person landing here from a deep link (e.g. "/my-attendance") gets
// the same chrome and can navigate anywhere else in the app without
// getting stranded on a bare, nav-less page. Only the scanner card itself
// (styles from ScanAttendance.module.css) is specific to this screen.
//
// OFFLINE ATTENDANCE - high-level shape (see the offline attendance
// design doc for the full architecture):
//
//   ONLINE:  unchanged - the camera/QR flow below is exactly what it was.
//            The one addition is that a successful scan response may
//            carry an `offlineAuthorization`, which gets captured into
//            the local IndexedDB journal for later offline use.
//   OFFLINE: there is no QR to scan (the rotating token requires a live
//            server round trip - see the design doc, section 4), so this
//            screen skips the camera entirely and shows a direct
//            "Clock in/out offline" action instead, or a "Device not
//            recognized" block state if this device/employee combination
//            has no live offline authorization.
//
// Reachability note: `online` below is navigator.onLine plus the browser
// `online`/`offline` events - it is NOT a live ping of Ehral's API (spec
// §40's fuller reachability check). That's a reasonable next step, not
// implemented in this pass.

const EMPLOYEE_NAV = [
  { icon: "ti-layout-dashboard", label: "Dashboard", section: "main" },
  { icon: "ti-users", label: "Workforce", section: "main", hodOnly: true },
  { icon: "ti-calendar-check", label: "Attendance", section: "main" },
  { icon: "ti-building", label: "Departments", section: "main", hodOnly: true },
  { icon: "ti-calendar-event", label: "Leave", section: "main" },
  { icon: "ti-mail", label: "Messages", section: "main" },
  { icon: "ti-cash-banknote", label: "Penalty", section: "tools" },
  { icon: "ti-bell", label: "Notifications", section: "tools" },
  { icon: "ti-user-circle", label: "My Profile", section: "account" },
  {
    icon: "ti-switch-horizontal",
    label: "My Accounts",
    section: "account",
    isFullPage: true,
  },
];

const ADMIN_NAV = [
  { icon: "ti-layout-dashboard", label: "Dashboard", section: "main" },
  { icon: "ti-users", label: "Workforce", section: "main" },
  { icon: "ti-calendar-check", label: "Attendance", section: "main" },
  { icon: "ti-qrcode", label: "QR Code", section: "main" },
  { icon: "ti-building", label: "Departments", section: "main" },
  { icon: "ti-calendar-event", label: "Leave", section: "main" },
  { icon: "ti-user-edit", label: "Profile Edits", section: "main" },
  { icon: "ti-mail", label: "Messages", section: "main" },
  { icon: "ti-cash-banknote", label: "Penalty", section: "tools" },
  { icon: "ti-chart-bar", label: "Reports", section: "tools" },
  { icon: "ti-bell", label: "Notifications", section: "tools" },
  { icon: "ti-settings", label: "My profile", section: "account" },
  {
    icon: "ti-switch-horizontal",
    label: "My Accounts",
    section: "account",
    isFullPage: true,
  },
];

// This screen doesn't have its own tab system - it's a single-purpose
// deep link - so "Attendance" is always shown as the active nav item
// (clocking in/out is an attendance action) rather than tracking a
// locally-switchable activeNav like the dashboards do.
const ACTIVE_LABEL = "Attendance";

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function initials(first, last) {
  const f = safeString(first).trim();
  const l = safeString(last).trim();
  const firstInitial = f.length > 0 ? f.charAt(0) : "";
  const lastInitial = l.length > 0 ? l.charAt(0) : "";
  const result = `${firstInitial}${lastInitial}`.toUpperCase();
  return result || "?";
}

export default function ScanAttendance() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scanLockRef = useRef(false); // prevents double-submitting the same frame

  const [cameraError, setCameraError] = useState("");
  // Camera is never started automatically - see startCamera() below.
  const [cameraState, setCameraState] = useState("idle");
  const [result, setResult] = useState(null); // { ok, message, action, status, offlinePending }
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [profile, setProfile] = useState(null);

  // ── Offline attendance state ──────────────────────────────────────────
  const online = useOnlineStatus();
  const [offlineAvailability, setOfflineAvailability] = useState(null); // { available, reason, expiresAt } | null while loading
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);

  // Mobile bottom-nav "Log out" - confirmed via LogoutConfirmModal before
  // the session is actually torn down, so a stray tap on a crowded phone
  // screen can't sign someone out by accident.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const isAdmin = user?.role === "ROLE_ADMIN";
  const dashboardPath = isAdmin ? "/dashboard" : "/my-dashboard";
  const NAV = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  const staffBadges = useStaffNavBadges(isAdmin ? "employer" : "employee");

  // Best-effort profile fetch, purely to dress the shared shell (business
  // logo/name, avatar, HOD-gated nav items) the same way the dashboards
  // do. Never blocks the scanner if it fails or is slow.
  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Best-effort - only businesses with Attendance Zone turned on actually
  // require this; everyone else's scan works exactly the same whether or
  // not location is available/granted. Short timeout so a slow/denied
  // location prompt never holds up an otherwise-valid scan.
  const getCoords = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000 },
      );
    });
  }, []);

  useEffect(() => {
    const session = readSession();
    const membershipId =
      session?.employeeMembershipId ||
      session?.membershipId ||
      session?.employee?.membershipId;
    const refresh = () =>
      setCooldownRemaining(getAttendanceCooldownRemaining(membershipId));
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Connectivity itself now comes from useOnlineStatus() above - shared
  // with OfflineBanner.jsx rather than each tracking navigator.onLine
  // separately.

  // Refresh local offline eligibility + pending count on mount, and
  // again any time connectivity is lost (about to matter for the UI).
  useEffect(() => {
    let cancelled = false;
    getLocalOfflineAvailability()
      .then((availability) => {
        if (!cancelled) setOfflineAvailability(availability);
      })
      .catch(() => {
        if (!cancelled) setOfflineAvailability({ available: false });
      });
    getPendingOfflineCount()
      .then((count) => {
        if (!cancelled) setPendingOfflineCount(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online]);

  // Connectivity returned - upload whatever is queued. Fire-and-forget;
  // failures just leave the queue for the next reconnect/retry, per
  // offlineAttendanceService's own contract.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    syncPendingOfflineAttendance()
      .then(() => getPendingOfflineCount())
      .then((count) => {
        if (!cancelled) setPendingOfflineCount(count);
      })
      .catch((err) => {
        console.warn("Offline attendance sync failed; will retry later.", err);
      });
    return () => {
      cancelled = true;
    };
  }, [online]);

  const handleDecoded = useCallback(
    async (token) => {
      if (scanLockRef.current || cooldownRemaining > 0) return;
      scanLockRef.current = true;
      setScanning(false);
      stopCamera();

      try {
        const coords = await getCoords();
        let action = null;
        try {
          const { data: attendance } = await getMyAttendance();
          const today = attendance.find((record) => {
            const dateValue = record.date || record.clockIn;
            if (!dateValue) return false;
            const date = new Date(dateValue);
            return date.toDateString() === new Date().toDateString();
          });
          if (!today?.clockIn) action = "CLOCK_IN";
          else if (!today?.clockOut) action = "CLOCK_OUT";
          // Keep the offline "next action" cache in sync with whatever the
          // server actually reports, since this is the one moment we know
          // for certain (an online read) - see setCachedTodayState's doc.
          setCachedTodayState({
            clockedIn: Boolean(today?.clockIn),
            clockedOut: Boolean(today?.clockOut),
          });
        } catch (actionError) {
          console.warn(
            "Could not determine attendance action for device proof.",
            actionError,
          );
        }

        const { data } = action
          ? await submitScanWithDeviceProof(token, coords, action)
          : await submitScan(token, coords, {});

        // A successful online action may have minted/renewed an offline
        // authorization for this device - persist it locally so it's
        // available the next time this device goes offline.
        captureOfflineAuthorization(data.offlineAuthorization);
        if (data.action) {
          setCachedTodayState(
            data.action === "CLOCK_IN"
              ? { clockedIn: true }
              : { clockedOut: true },
          );
        }
        getLocalOfflineAvailability()
          .then(setOfflineAvailability)
          .catch(() => {});

        const session = readSession();
        const membershipId =
          session?.employeeMembershipId ||
          session?.membershipId ||
          session?.employee?.membershipId;
        setCooldownRemaining(
          startAttendanceCooldown(membershipId, data.timestamp),
        );
        setResult({
          ok: true,
          action: data.action,
          status: data.status,
          message: data.message,
        });
      } catch (err) {
        const msg = getAttendanceErrorMessage(err);
        if (
          typeof msg === "string" &&
          /wait.*3 minute|3 minute.*wait|three minute|attendance was just recorded/i.test(
            msg,
          )
        ) {
          const session = readSession();
          const membershipId =
            session?.employeeMembershipId ||
            session?.membershipId ||
            session?.employee?.membershipId;
          setCooldownRemaining(startAttendanceCooldown(membershipId));
        }
        setResult({
          ok: false,
          message: typeof msg === "string" ? msg : "Scan failed.",
        });
      }
    },
    [stopCamera, getCoords, cooldownRemaining],
  );

  // ── Offline: direct clock in/out (no camera, no QR) ─────────────────
  const handleOfflineAction = useCallback(async () => {
    const action = nextOfflineAction();
    if (!action || offlineSubmitting) return;

    setOfflineSubmitting(true);
    try {
      const coords = await getCoords();
      await recordOfflineAttendance(action, coords);
      const count = await getPendingOfflineCount();
      setPendingOfflineCount(count);
      setResult({
        ok: true,
        action,
        status: null,
        offlinePending: true,
        message:
          action === "CLOCK_IN"
            ? "Clock-in recorded offline. It will be verified when you're back online."
            : "Clock-out recorded offline. Ehral will verify it when you're back online.",
      });
    } catch (err) {
      setResult({
        ok: false,
        message:
          err?.message ||
          "Couldn't record offline attendance. Please try again.",
      });
    } finally {
      setOfflineSubmitting(false);
    }
  }, [getCoords, offlineSubmitting]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        handleDecoded(code.data);
        return; // stop the loop - handleDecoded() already calls stopCamera()
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  const requestCamera = useCallback(async (constraints) => {
    return Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("camera-timeout")), 8000),
      ),
    ]);
  }, []);

  const startCamera = useCallback(async () => {
    if (cooldownRemaining > 0) {
      setResult(
        (current) =>
          current || {
            ok: false,
            message: `Attendance was just recorded. Please wait ${formatAttendanceCooldown(cooldownRemaining)} before scanning again.`,
          },
      );
      setScanning(false);
      return;
    }
    setCameraError("");
    setCameraState("starting");

    if (!window.isSecureContext) {
      setCameraError(
        "Camera access requires a secure (https) connection. Please reload this page over https and try again.",
      );
      setCameraState("idle");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser doesn't support camera access. Please try a different or updated browser.",
      );
      setCameraState("idle");
      return;
    }

    try {
      let stream;
      try {
        stream = await requestCamera({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (err) {
        if (err?.name === "NotAllowedError") throw err;
        // No rear camera matched the constraint (common on
        // laptops/desktops) - fall back to whatever camera is available.
        stream = await requestCamera({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("running");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const message =
        err?.message === "camera-timeout"
          ? "The camera took too long to start. Check browser permissions and try again."
          : err?.name === "NotAllowedError"
            ? "Camera permission was denied. Please allow camera access for this site in your browser settings, then try again."
            : err?.name === "NotFoundError"
              ? "No camera was found on this device."
              : "Couldn't access your camera. Please allow camera permission and try again.";
      setCameraError(message);
      setCameraState("idle");
    }
  }, [tick, requestCamera]);

  // No auto-start - see QrScanModal.jsx for why. getUserMedia only ever
  // runs from a direct tap ("Enable camera" / "Try again" below).
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleScanAgain = () => {
    if (cooldownRemaining > 0) return;
    setResult(null);

    // Offline: nothing to scan - just clear the result and re-show the
    // offline action panel. Only the ONLINE path re-engages the camera.
    if (!online) return;

    scanLockRef.current = false;
    setScanning(true);
    startCamera();
  };

  const handleNavClick = (n) => {
    if (n.isFullPage) {
      navigate("/my-accounts", {
        state: { returnPath: dashboardPath, activeNav: ACTIVE_LABEL },
      });
      return;
    }
    navigate(dashboardPath, { state: { activeNav: n.label } });
  };

  const firstName = profile?.firstName || "";
  const lastName = profile?.lastName || "";
  const displayName = `${firstName} ${lastName}`.trim();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const offlineAction = nextOfflineAction();

  return (
    <div className={dash.dash}>
      {/* ── Sidebar (desktop) ── */}
      <aside className={dash.sidebar}>
        <div className={dash.sbLogo}>
          {profile?.businessLogo ? (
            <img
              src={profile.businessLogo}
              alt={profile?.businessName || "Business logo"}
              className={dash.sbLogoImg}
            />
          ) : (
            <div className={dash.sbLogoIcon}>💼</div>
          )}
          <span className={dash.sbLogoText}>
            {profile?.businessName || "Ehra"}
          </span>
        </div>

        <nav className={dash.sbNav}>
          {["main", "tools", "account"].map((section) => (
            <div key={section}>
              <div className={dash.sbSection}>{section}</div>
              {NAV.filter(
                (n) => n.section === section && (!n.hodOnly || profile?.isHod),
              ).map((n) => (
                <div
                  key={n.label}
                  className={`${dash.sbItem} ${n.label === ACTIVE_LABEL ? dash.active : ""}`}
                  onClick={() => handleNavClick(n)}
                >
                  <i className={`ti ${n.icon}`} aria-hidden="true" />
                  {n.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className={dash.sbFooter}>
          <div className={dash.sbUser}>
            <div className={dash.sbAvatar}>
              {profile?.profilePictureUrl ? (
                <img
                  src={profile.profilePictureUrl}
                  alt=""
                  className={dash.sbAvatarImg}
                />
              ) : (
                initials(firstName, lastName)
              )}
            </div>
            <div className={dash.sbUserRow}>
              <div>
                <div className={dash.sbUserName}>
                  {displayName || (isAdmin ? "Admin" : "Employee")}
                </div>
                <div className={dash.sbUserRole}>
                  {isAdmin
                    ? "Employer"
                    : profile?.isHod
                      ? "Employee · HOD"
                      : "Employee"}
                </div>
              </div>
              <button
                type="button"
                className={dash.sbLogoutBtn}
                onClick={logout}
                aria-label="Log out"
                title="Log out"
              >
                <i className="ti ti-logout" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={dash.main}>
        <div className={dash.topbar}>
          <div>
            <h1 className={dash.topbarTitle}>
              <span className={dash.topbarTitleFull}>Clock In / Out</span>
              <span className={dash.topbarTitleShort}>Attendance</span>
            </h1>
            <p className={dash.topbarSub}>{today}</p>
          </div>

          <div className={dash.topbarRight}>
            <ThemeToggleMenu />
          </div>
        </div>

        <div className={dash.content}>
          <div className={styles.scanCard}>
            <div
              className={`${styles.connectionBadge} ${
                online ? styles.connectionOnline : styles.connectionOffline
              }`}
            >
              <i
                className={`ti ${online ? "ti-wifi" : "ti-wifi-off"}`}
                aria-hidden="true"
              />
              {online ? "Connected" : "Offline"}
              {pendingOfflineCount > 0 && (
                <span className={styles.pendingBadge}>
                  · {pendingOfflineCount} pending
                </span>
              )}
            </div>

            <h2 className={styles.title}>
              {online ? "Scan to clock in / out" : "Clock in / out offline"}
            </h2>
            <p className={styles.subtitle}>
              {online
                ? "Point your camera at the QR code on the admin's screen."
                : "No connection needed - this will sync automatically once you're back online."}
            </p>

            <div className={styles.scannerFrame}>
              {online && (
                <>
                  {/* Always mounted - see startCamera() above for why: it
                      assigns the stream to videoRef.current before cameraState
                      becomes "running", so this element must already exist in
                      the DOM at that point or the assignment silently no-ops
                      and the video that mounts afterwards has no stream. */}
                  <video
                    ref={videoRef}
                    className={`${styles.video} ${
                      scanning && cameraState === "running" && !cameraError
                        ? ""
                        : styles.videoHidden
                    }`}
                    playsInline
                    muted
                  />

                  {scanning && cameraState === "running" && !cameraError && (
                    <div className={styles.scanOverlay}>
                      <div className={styles.scanBox} />
                    </div>
                  )}

                  {cameraState === "idle" && !cameraError && scanning && (
                    <div className={styles.errorState}>
                      <i
                        className="ti ti-camera"
                        style={{ fontSize: 32 }}
                        aria-hidden="true"
                      />
                      <p>Tap below to enable your camera and scan.</p>
                      <button className={styles.retryBtn} onClick={startCamera}>
                        Enable camera
                      </button>
                    </div>
                  )}

                  {cameraState === "starting" && !cameraError && (
                    <div className={styles.errorState}>
                      <p>Requesting camera access…</p>
                    </div>
                  )}

                  {cameraError && (
                    <div className={styles.errorState}>
                      <i
                        className="ti ti-camera-off"
                        style={{ fontSize: 32 }}
                        aria-hidden="true"
                      />
                      <p>{cameraError}</p>
                      <button className={styles.retryBtn} onClick={startCamera}>
                        Try again
                      </button>
                    </div>
                  )}
                </>
              )}

              {!online && !result && (
                <div className={styles.offlinePanel}>
                  {offlineAvailability === null ? (
                    <p>Checking this device…</p>
                  ) : offlineAvailability.available ? (
                    offlineAction ? (
                      <>
                        <i
                          className="ti ti-cloud-off"
                          style={{ fontSize: 32 }}
                          aria-hidden="true"
                        />
                        <p>
                          You're offline, but this device is authorized. Your{" "}
                          {offlineAction === "CLOCK_OUT"
                            ? "clock-out"
                            : "clock-in"}{" "}
                          will be recorded locally and verified once you're back
                          online.
                        </p>
                        <button
                          type="button"
                          className={styles.offlineActionBtn}
                          onClick={handleOfflineAction}
                          disabled={offlineSubmitting}
                        >
                          {offlineSubmitting
                            ? "Recording…"
                            : offlineAction === "CLOCK_OUT"
                              ? "Clock out offline"
                              : "Clock in offline"}
                        </button>
                      </>
                    ) : (
                      <>
                        <i
                          className="ti ti-circle-check"
                          style={{ fontSize: 32 }}
                          aria-hidden="true"
                        />
                        <p>You've already completed attendance for today.</p>
                      </>
                    )
                  ) : (
                    <>
                      <i
                        className="ti ti-device-mobile-off"
                        style={{ fontSize: 32 }}
                        aria-hidden="true"
                      />
                      <p
                        style={{
                          fontWeight: 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        Device not recognized
                      </p>
                      <p>
                        Ehral doesn't recognize this device as an authorized
                        attendance device for your employee account. Offline
                        attendance isn't available on this device.
                      </p>
                      <p>
                        Connect to the internet to verify your device, then
                        clock in normally.
                      </p>
                    </>
                  )}
                </div>
              )}

              {result && (
                <div
                  className={`${styles.resultState} ${result.ok ? styles.resultOk : styles.resultFail}`}
                >
                  <i
                    className={`ti ${result.ok ? "ti-circle-check" : "ti-circle-x"}`}
                    style={{ fontSize: 40 }}
                    aria-hidden="true"
                  />
                  <p className={styles.resultMessage}>{result.message}</p>
                  {result.ok && (
                    <span className={styles.resultAction}>
                      {result.action === "CLOCK_IN"
                        ? "Clocked in"
                        : "Clocked out"}
                      {result.offlinePending ? " · Pending verification" : ""}
                    </span>
                  )}
                  {cooldownRemaining > 0 && (
                    <span className={styles.resultCooldown}>
                      You can scan again in{" "}
                      {formatAttendanceCooldown(cooldownRemaining)}.
                    </span>
                  )}
                  <button
                    className={styles.scanAgainBtn}
                    onClick={handleScanAgain}
                    disabled={cooldownRemaining > 0}
                  >
                    {online ? "Scan again" : "OK"}
                  </button>
                </div>
              )}
            </div>

            <details className={styles.helpDetails}>
              <summary className={styles.helpSummary}>
                How attendance security works
                <i className="ti ti-chevron-down" aria-hidden="true" />
              </summary>
              <div className={styles.helpBody}>
                <div>
                  <h5>Online</h5>
                  <ul>
                    <li>Ehral verifies attendance in real time.</li>
                    <li>A recognized device can clock in/out.</li>
                    <li>A new device can be verified online.</li>
                    <li>
                      New or suspicious device activity may generate a security
                      alert.
                    </li>
                  </ul>
                </div>
                <div>
                  <h5>Offline</h5>
                  <ul>
                    <li>
                      Only a device already recognized and authorized by Ehral
                      can clock offline.
                    </li>
                    <li>New devices can't clock offline.</li>
                    <li>
                      Clearing browser/site storage can remove the local
                      security credential.
                    </li>
                    <li>
                      If that happens, reconnect to the internet to verify the
                      device.
                    </li>
                  </ul>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom navigation ──
          The SAME MobileNavHub the employer / employee dashboards use, with
          Attendance as the current destination (the scanner is an attendance
          action, so Operations is highlighted). Picking anything goes back to
          the dashboard on that section. */}
      <MobileNavHub
        role={isAdmin ? "employer" : "employee"}
        activeNav={ACTIVE_LABEL}
        setActiveNav={(key) =>
          navigate(dashboardPath, { state: { activeNav: key } })
        }
        navigate={navigate}
        isHod={Boolean(profile?.isHod)}
        badges={staffBadges}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </div>
  );
}
