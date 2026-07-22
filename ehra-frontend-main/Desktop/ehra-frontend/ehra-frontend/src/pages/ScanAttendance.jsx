import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { submitScan } from "../api/attendanceApi";
import { getMyProfile } from "../api/employeeApi";
import { useAuth } from "../context/AuthContext";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import dash from "./Dashboard.module.css";
import styles from "./ScanAttendance.module.css";

// This page reuses the exact same shell (sidebar, topbar, mobile bottom
// nav) as Dashboard.jsx / EmployeeDashboard.jsx via Dashboard.module.css,
// so a person landing here from a deep link (e.g. "/my-attendance") gets
// the same chrome and can navigate anywhere else in the app without
// getting stranded on a bare, nav-less page. Only the scanner card itself
// (styles from ScanAttendance.module.css) is specific to this screen.

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

// This screen doesn't have its own tab system — it's a single-purpose
// deep link — so "Attendance" is always shown as the active nav item
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

// Tracks a horizontally-scrollable element and returns { left, width } as
// percentages of its own track — same helper used on the dashboards, kept
// local here since it isn't exported from anywhere shared.
function useScrollThumb(ref) {
  const [thumb, setThumb] = useState({ left: 0, width: 100 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setThumb({ left: 0, width: 100 });
        return;
      }
      const width = Math.max((clientWidth / scrollWidth) * 100, 15);
      const maxScroll = scrollWidth - clientWidth;
      const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - width) : 0;
      setThumb({ left, width });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return thumb;
}

export default function ScanAttendance() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scanLockRef = useRef(false); // prevents double-submitting the same frame
  const bottomNavScrollRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  // Camera is never started automatically — see startCamera() below.
  const [cameraState, setCameraState] = useState("idle");
  const [result, setResult] = useState(null); // { ok, message, action, status }
  const [scanning, setScanning] = useState(true);
  const [profile, setProfile] = useState(null);

  // Mobile bottom-nav "Log out" — confirmed via LogoutConfirmModal before
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
  const bottomNavThumb = useScrollThumb(bottomNavScrollRef);

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

  // Best-effort — only businesses with Attendance Zone turned on actually
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

  const handleDecoded = useCallback(
    async (token) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setScanning(false);
      stopCamera();

      try {
        const coords = await getCoords();
        const { data } = await submitScan(token, coords);
        setResult({
          ok: true,
          action: data.action,
          status: data.status,
          message: data.message,
        });
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          "Scan failed. Please try again.";
        setResult({
          ok: false,
          message: typeof msg === "string" ? msg : "Scan failed.",
        });
      }
    },
    [stopCamera, getCoords],
  );

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
        return; // stop the loop — handleDecoded() already calls stopCamera()
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
        // laptops/desktops) — fall back to whatever camera is available.
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
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access for this site in your browser settings, then try again."
          : err?.name === "NotFoundError"
            ? "No camera was found on this device."
            : "Couldn't access your camera. Please allow camera permission and try again.";
      setCameraError(message);
      setCameraState("idle");
    }
  }, [tick, requestCamera]);

  // No auto-start — see QrScanModal.jsx for why. getUserMedia only ever
  // runs from a direct tap ("Enable camera" / "Try again" below).
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleScanAgain = () => {
    scanLockRef.current = false;
    setResult(null);
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
            <h2 className={styles.title}>Scan to clock in / out</h2>
            <p className={styles.subtitle}>
              Point your camera at the QR code on the admin's screen.
            </p>

            <div className={styles.scannerFrame}>
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

              {scanning && cameraState === "running" && !cameraError && (
                <>
                  <video
                    ref={videoRef}
                    className={styles.video}
                    playsInline
                    muted
                  />
                  <div className={styles.scanOverlay}>
                    <div className={styles.scanBox} />
                  </div>
                </>
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
                    </span>
                  )}
                  <button
                    className={styles.scanAgainBtn}
                    onClick={handleScanAgain}
                  >
                    Scan again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className={dash.bottomNav} aria-label="Primary">
        <div className={dash.bottomNavScroll} ref={bottomNavScrollRef}>
          {NAV.filter(
            (n) =>
              (!n.hodOnly || profile?.isHod) &&
              n.label !== "Notifications" &&
              n.label !== "Messages",
          ).map((n) => (
            <button
              key={n.label}
              type="button"
              className={`${dash.bottomNavItem} ${n.label === ACTIVE_LABEL ? dash.bottomNavActive : ""}`}
              onClick={() => handleNavClick(n)}
            >
              <div className={dash.bottomNavIconWrap}>
                <i className={`ti ${n.icon}`} aria-hidden="true" />
              </div>
              <span>{n.label}</span>
            </button>
          ))}

          {/* Logout has no sidebar/desktop equivalent in this strip — on
              desktop it's the icon button in the sidebar footer instead.
              This item only ever renders inside .bottomNav, which is
              display:none above 900px, so it's mobile-only by construction. */}
          <button
            type="button"
            className={dash.bottomNavItem}
            onClick={() => setShowLogoutConfirm(true)}
          >
            <div className={dash.bottomNavIconWrap}>
              <i className="ti ti-logout" aria-hidden="true" />
            </div>
            <span>Log out</span>
          </button>
        </div>
        <div className={dash.bottomNavScrollTrack} aria-hidden="true">
          <div
            className={dash.bottomNavScrollThumb}
            style={{
              width: `${bottomNavThumb.width}%`,
              left: `${bottomNavThumb.left}%`,
            }}
          />
        </div>
      </nav>

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </div>
  );
}
