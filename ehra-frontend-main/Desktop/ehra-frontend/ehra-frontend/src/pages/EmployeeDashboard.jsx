import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { getMyAttendance } from "../api/attendanceApi";
import { getMyPenaltySummary } from "../api/penaltyApi";
import useMessageStream from "../hooks/useMessageStream";
import styles from "./Dashboard.module.css";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import {
  getAllProfileEdits,
  getPendingProfileEdits,
  submitEmployerDecision,
} from "../api/profileEditApi";
// Employee/HOD-scoped tabs — these replace the employer-only components
// (WorkforceTab, LeavesTab, AttendanceSection, MessagesTab, PenaltyTab,
// ReportsTab, ProfileEditApprovalPanel mode="employer", BusinessSettingsTab,
// DepartmentsTab) that were previously wired into this file despite it
// rendering for ROLE_EMPLOYEE sessions — every one of those calls an
// ADMIN-only endpoint (or, for DepartmentsTab, exposes full company-wide
// department CRUD) and isn't appropriate for an employee/HOD session.
// "Departments" reuses HodWorkforceTab, same as "Workforce" — both are
// scoped to the HOD's own department via GET /employees/my-department.
import HodWorkforceTab from "../components/Hodworkforcetab";
import EmployeeInbox from "../components/EmployeeMessagesInbox";
import EmployeeLeaveTab from "../components/EmployeeLeaveTab";
import EmployeeAttendanceTab from "../components/EmployeeAttendanceTab";
import EmployeePenaltyTab from "../components/EmployeePenaltyTab";
import MyProfileTab from "../components/MyProfileTab";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import CoverRequestsTab from "../components/CoverRequestsTab";
import { getMyProfile } from "../api/employeeApi";
import { getMyCoverRequests } from "../api/leaveApi";

// ── Sidebar nav ────────────────────────────────────────────────────────────
// "My Accounts" navigates to the full-page identity-level workspace
// switcher (see MyAccountsPage) instead of switching the main content area.
// "Workforce" and "Departments" are filtered out for non-HOD employees at
// render time — see the NAV.filter(...) call in the sidebar rendering
// below. Regular employees never see either: department management is an
// employer/HOD-only concept, and an HOD only ever sees their own
// department's employees, never the whole company. "Reports" has no
// employee/HOD equivalent (business-wide reporting is an employer-only
// concept) so it isn't in this list at all.
const NAV = [
  { icon: "ti-layout-dashboard", label: "Dashboard", section: "main" },
  { icon: "ti-users", label: "Workforce", section: "main", hodOnly: true },
  { icon: "ti-calendar-check", label: "Attendance", section: "main" },
  { icon: "ti-building", label: "Departments", section: "main", hodOnly: true },
  { icon: "ti-calendar-event", label: "Leave", section: "main" },
  { icon: "ti-user-shield", label: "Cover Requests", section: "main" },
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

function fullName(first, last) {
  return [safeString(first), safeString(last)].filter(Boolean).join(" ").trim();
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const NOTIF_ICON_CLASS = {
  EMPLOYEE_REGISTRATION: styles["notifIcon"] + " " + styles["reg"],
  EMPLOYEE_APPROVED: styles["notifIcon"] + " " + styles["ok"],
  EMPLOYEE_REJECTED: styles["notifIcon"] + " " + styles["no"],
  SYSTEM: styles["notifIcon"] + " " + styles["sys"],
};

const NOTIF_ICON = {
  EMPLOYEE_REGISTRATION: "ti-user-plus",
  EMPLOYEE_APPROVED: "ti-user-check",
  EMPLOYEE_REJECTED: "ti-user-x",
  SYSTEM: "ti-info-circle",
};

// Matches com.Ehra.Enums.AttendanceStatus exactly: PRESENT, LATE,
// EARLY_LEAVE, ABSENT. Keys here map to the pill_* classes in
// Dashboard.module.css.
const ATTENDANCE_PILL = {
  PRESENT: "pill_present",
  LATE: "pill_late",
  EARLY_LEAVE: "pill_early",
  ABSENT: "pill_absent",
};

const ATTENDANCE_LABEL = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early leave",
  ABSENT: "Absent",
};

// Tracks a horizontally-scrollable element and returns { left, width } as
// percentages of its own track — feeds the thin "underneath line" scroll
// indicators (quick actions pill row, bottom nav strip) so the thumb's
// size/position always reflects exactly how much more there is to scroll,
// rather than a static decorative hint.
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

// Time-of-day greeting — recomputed on every render (cheap), so it flips
// from "Good morning" to "Good afternoon" etc. the moment someone's still
// on the dashboard when the hour rolls over, no reload needed. The icon
// rides along so the greeting reads as a genuine "what time is it for
// you" cue rather than a static "Hi" pasted at the top of the page.
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return { text: "Still up", icon: "ti-moon-stars" };
  if (hour < 12) return { text: "Good morning", icon: "ti-sunrise" };
  if (hour < 17) return { text: "Good afternoon", icon: "ti-sun" };
  if (hour < 21) return { text: "Good evening", icon: "ti-sunset-2" };
  return { text: "Working late", icon: "ti-moon-stars" };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

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
      navigate("/login");
    }
  };

  // Same idea as the admin dashboard — land on the tab we came from
  // instead of resetting to "Dashboard" every time.
  const [activeNav, setActiveNav] = useState(
    location.state?.activeNav || "Dashboard",
  );

  // Summary
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Notifications
  const [notifs, setNotifs] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [actioningNotif, setActioningNotif] = useState(null); // id being actioned
  // Optimistic delete-with-undo: a notification leaves `notifs` the instant
  // the user deletes it, but the actual DELETE call is held for 3s so the
  // action can be undone. Shared between the bell dropdown and the full
  // Notifications page, since they read from the same state.
  const [pendingDeletes, setPendingDeletes] = useState([]); // [{ id, notif }]
  const deleteTimers = useRef(new Map());
  const notifRef = useRef(null);
  const qaScrollRef = useRef(null);
  const bottomNavScrollRef = useRef(null);
  const qaThumb = useScrollThumb(qaScrollRef);
  const bottomNavThumb = useScrollThumb(bottomNavScrollRef);

  const [recentActivityOpen, setRecentActivityOpen] = useState(false);

  // My attendance + payroll — the employee-facing dashboard home content
  // (replaces the employer's "Today's Pulse" business-wide widget, which
  // never belonged here — see fetchMyAttendanceSummary/fetchMyPayroll).
  const [myAttendance, setMyAttendance] = useState([]);
  const [loadingMyAttendance, setLoadingMyAttendance] = useState(true);
  const [myPayroll, setMyPayroll] = useState(null);
  const [loadingMyPayroll, setLoadingMyPayroll] = useState(true);

  // Profile edit requests — employer approval queue (final sign-off after
  // the HOD, or first stop if the employee has no HOD).
  const [profileEdits, setProfileEdits] = useState([]);
  const [pendingProfileEdits, setPendingProfileEdits] = useState([]);
  const [loadingProfileEdits, setLoadingProfileEdits] = useState(true);

  // The employer's own profile (auto-created Employee row, role ADMIN) —
  // Settings tab "My Profile". Edits here save instantly, no approval.
  const [myProfile, setMyProfile] = useState(null);
  const [loadingMyProfile, setLoadingMyProfile] = useState(true);

  // Cover requests — leaves where a colleague has nominated ME as their
  // cover person. Fetched lightly here (just for the sidebar/bottom-nav
  // badge count); the full working list lives in CoverRequestsTab itself.
  // Any employee can be nominated, regardless of role, so this isn't
  // gated behind isHod like Workforce/Departments.
  const [coverRequests, setCoverRequests] = useState([]);
  const coverRequestsPendingCount = coverRequests.filter(
    (l) => l.status === "PENDING_COVER",
  ).length;

  // ── Fetchers ──────────────────────────────────────────────────────────

  const [summaryError, setSummaryError] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      setSummaryError(false);
      const { data } = await API.get("/business/dashboard-summary");
      setSummary(data);
    } catch (err) {
      console.error("Failed to load dashboard summary:", err);
      setSummaryError(true);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const { data } = await API.get("/notifications");
      // ADMIN_MESSAGE is handled exclusively in the Messages tab
      setNotifs(data.filter((n) => n.type !== "ADMIN_MESSAGE"));
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const fetchMyAttendanceSummary = useCallback(async () => {
    try {
      setLoadingMyAttendance(true);
      const { data } = await getMyAttendance();
      setMyAttendance(data);
    } catch (err) {
      console.error("Failed to load my attendance:", err);
    } finally {
      setLoadingMyAttendance(false);
    }
  }, []);

  const fetchMyPayroll = useCallback(async () => {
    try {
      setLoadingMyPayroll(true);
      const { data } = await getMyPenaltySummary();
      setMyPayroll(data);
    } catch (err) {
      console.error("Failed to load my payroll summary:", err);
    } finally {
      setLoadingMyPayroll(false);
    }
  }, []);

  const fetchCoverRequests = useCallback(async () => {
    try {
      const { data } = await getMyCoverRequests();
      setCoverRequests(data);
    } catch (err) {
      console.error("Failed to load cover requests:", err);
    }
  }, []);

  // Profile edits awaiting the employer's decision (plus full history for
  // the "All requests" view in the panel).
  const fetchProfileEdits = useCallback(async () => {
    try {
      setLoadingProfileEdits(true);
      const [allRes, pendingRes] = await Promise.all([
        getAllProfileEdits(),
        getPendingProfileEdits(),
      ]);
      setProfileEdits(allRes.data);
      setPendingProfileEdits(pendingRes.data);
    } catch (err) {
      console.error("Failed to load profile edit requests:", err);
    } finally {
      setLoadingProfileEdits(false);
    }
  }, []);

  // The employer's own profile (Employee row, role ADMIN)
  const fetchMyProfile = useCallback(async () => {
    try {
      setLoadingMyProfile(true);
      const { data } = await getMyProfile();
      setMyProfile(data);
    } catch (err) {
      console.error("Failed to load your profile:", err);
    } finally {
      setLoadingMyProfile(false);
    }
  }, []);

  // Quick actions row: a brief, one-time "nudge" scroll on mount so the
  // row visibly demonstrates it's scrollable at a glance, rather than
  // relying only on the static peek/fade cues (which people can miss on
  // first load). No-op on desktop, where this row isn't a scroll
  // container at all.
  useEffect(() => {
    const el = qaScrollRef.current;
    if (!el) return undefined;
    const nudgeOut = setTimeout(() => {
      el.scrollTo({ left: 64, behavior: "smooth" });
    }, 550);
    const nudgeBack = setTimeout(() => {
      el.scrollTo({ left: 0, behavior: "smooth" });
    }, 1050);
    return () => {
      clearTimeout(nudgeOut);
      clearTimeout(nudgeBack);
    };
  }, []);

  // Locks page-level scrolling to <body> while this app-shell page is
  // mounted, so mobile browsers can't rubber-band the whole page (and
  // drag the "fixed" topbar along with it) — only .content should scroll.
  useEffect(() => {
    document.body.classList.add("app-shell-lock");
    return () => document.body.classList.remove("app-shell-lock");
  }, []);

  useEffect(() => {
    // fetchPending, fetchPendingLeaves, fetchLatestAttendance, fetchDirectory,
    // fetchProfileEdits and fetchBusinessProfile are ALL admin-only
    // endpoints — calling them here on every employee login is what
    // produced the 403 storm (and the refresh/retry cascade that could tip
    // into a forced logout). They're intentionally NOT called from this
    // mount effect; the panels that used to depend on their data have been
    // replaced with employee/HOD-scoped equivalents (EmployeeLeaveTab,
    // EmployeeAttendanceTab, EmployeeProfileEditsTab, HodWorkforceTab) that
    // fetch their own data lazily when their tab is opened. The dashboard
    // home now shows the employee's own attendance + payroll instead of a
    // business-wide "Today's Pulse" widget, fetched via the /me-scoped
    // endpoints below.
    fetchSummary();
    fetchNotifs();
    fetchMyProfile();
    fetchMyAttendanceSummary();
    fetchMyPayroll();
    fetchCoverRequests();
  }, [
    fetchSummary,
    fetchNotifs,
    fetchMyProfile,
    fetchMyAttendanceSummary,
    fetchMyPayroll,
    fetchCoverRequests,
  ]);

  // ── Real-time: prepend new notifications without reloading ─────────────
  useMessageStream({
    onNewNotification: (payload) => {
      if (payload.type === "ADMIN_MESSAGE") return;
      setNotifs((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev;
        return [payload, ...prev];
      });
      // NOTE: this used to call fetchPendingLeaves()/fetchProfileEdits()
      // here (both ADMIN-only) in reaction to these events — removed for
      // the same reason as the mount effect above. EmployeeLeaveTab and
      // EmployeeProfileEditsTab re-fetch their own correct data whenever
      // their tab is open.
    },
    // Keeps the "Cover Requests" sidebar/bottom-nav badge live — only
    // reacts to leaves where I'm the nominated cover person, same guard
    // CoverRequestsTab itself uses, so this stays a cheap in-place patch
    // rather than a re-fetch.
    onLeaveUpdate: (leave) => {
      if (!leave || !user?.membershipId) return;
      if (leave.coverPersonId !== user.membershipId) return;
      setCoverRequests((prev) => {
        const exists = prev.some((l) => l.id === leave.id);
        if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
        return [leave, ...prev];
      });
    },
  });

  // Refresh notifications whenever the full-page Notifications tab is opened
  useEffect(() => {
    if (activeNav === "Notifications") fetchNotifs();
  }, [activeNav, fetchNotifs]);

  // Close notification panel on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleEmployerProfileEditDecide = async (id, approved, note) => {
    await submitEmployerDecision(id, { approved, note: note || null });
    await fetchProfileEdits();
  };

  const openNotifPanel = () => {
    // Mobile/tablet: skip the dropdown entirely and jump straight to the
    // full Notifications page — a small popover is awkward to use on a
    // touch screen and the page itself is only one tap away anyway.
    if (window.innerWidth <= 900) {
      setActiveNav("Notifications");
      fetchNotifs();
      return;
    }
    setNotifOpen((v) => !v);
    if (!notifOpen) fetchNotifs();
  };

  const markOneRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      fetchSummary();
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      await API.put("/notifications/read-all");
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      fetchSummary();
    } catch {
      /* ignore */
    }
  };

  // ── Delete with undo ──────────────────────────────────────────────────
  // Removing a notification is instant in the UI; the DELETE request itself
  // fires after a 3s grace period so "Undo" can cancel it before anything
  // actually happens server-side.
  const commitDelete = useCallback(
    async (id) => {
      deleteTimers.current.delete(id);
      setPendingDeletes((prev) => prev.filter((p) => p.id !== id));
      try {
        await API.delete(`/notifications/${id}`);
        fetchSummary();
      } catch {
        /* already gone from the UI either way */
      }
    },
    [fetchSummary],
  );

  const deleteNotif = useCallback(
    (notif) => {
      setNotifs((prev) => prev.filter((n) => n.id !== notif.id));
      setPendingDeletes((prev) => [
        ...prev.filter((p) => p.id !== notif.id),
        { id: notif.id, notif },
      ]);
      const timer = setTimeout(() => commitDelete(notif.id), 3000);
      deleteTimers.current.set(notif.id, timer);
    },
    [commitDelete],
  );

  const undoDelete = useCallback((id) => {
    const timer = deleteTimers.current.get(id);
    if (timer) clearTimeout(timer);
    deleteTimers.current.delete(id);
    setPendingDeletes((prev) => {
      const entry = prev.find((p) => p.id === id);
      if (entry) {
        setNotifs((cur) =>
          cur.some((n) => n.id === id)
            ? cur
            : [...cur, entry.notif].sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
              ),
        );
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // Timers must keep running even if the user switches tabs (Dashboard
  // stays mounted), but if the whole page unmounts, finish the deletes
  // rather than silently dropping them — the user already confirmed intent.
  useEffect(() => {
    return () => {
      deleteTimers.current.forEach((timer, id) => {
        clearTimeout(timer);
        API.delete(`/notifications/${id}`).catch(() => {});
      });
      deleteTimers.current.clear();
    };
  }, []);

  const refreshAll = useCallback(
    () => Promise.all([fetchSummary(), fetchNotifs()]),
    [fetchSummary, fetchNotifs],
  );

  const approveFromNotif = async (notif) => {
    if (!notif.employeeId) return;
    try {
      setActioningNotif(notif.id);
      await API.post(`/employees/${notif.employeeId}/approve`);
      await refreshAll();
    } catch {
      alert("Unable to approve. Please try again.");
    } finally {
      setActioningNotif(null);
    }
  };

  const rejectFromNotif = async (notif) => {
    const name = fullName(notif?.employeeFirstName, notif?.employeeLastName);
    if (!window.confirm(`Reject ${name}'s registration?`)) return;
    try {
      setActioningNotif(notif.id);
      await API.post(`/employees/${notif.employeeId}/reject`);
      await refreshAll();
    } catch {
      alert("Unable to reject. Please try again.");
    } finally {
      setActioningNotif(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // myProfile (GET /employees/me) is the logged-in employee's OWN record
  // — resolved server-side from their EmployeeMembership. summary (GET
  // /business/dashboard-summary) is business-wide and its "admin" fields
  // are the employer's name, not whoever's actually logged in — using it
  // for "my name" was wrong for any non-employer viewer. myFirst/myLast
  // are the source of truth for anything that should say "you" (topbar
  // greeting, sidebar footer identity).
  const myFirst = myProfile?.firstName ?? "";
  const myLast = myProfile?.lastName ?? "";
  const companyName =
    myProfile?.businessName ?? summary?.companyName ?? "Your Company";
  const unreadCount = (notifs || []).filter((n) => !n?.isRead).length;
  const greeting = getTimeGreeting();

  // Today's row from the employee's own attendance history (GET
  // /attendance/me) — replaces the employer's business-wide "Today's
  // Pulse" widget, which never belonged on an employee's own dashboard.
  const myAttendanceToday = myAttendance.find((r) => {
    const d = new Date(r.date || r.clockIn);
    return d.toDateString() === new Date().toDateString();
  });

  const myAttendanceThisWeek = (() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const inWeek = myAttendance.filter((r) => {
      const d = new Date(r.date || r.clockIn);
      return d >= startOfWeek && d <= now;
    });
    return {
      present: inWeek.filter((r) => r.status === "PRESENT").length,
      late: inWeek.filter((r) => r.status === "LATE").length,
      absent: inWeek.filter((r) => r.status === "ABSENT").length,
    };
  })();

  const money = (v) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.dash}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sbLogo}>
          {myProfile?.businessLogo ? (
            <img
              src={myProfile.businessLogo}
              alt={myProfile?.businessName || "Business logo"}
              className={styles.sbLogoImg}
            />
          ) : (
            <div className={styles.sbLogoIcon}>💼</div>
          )}
          <span className={styles.sbLogoText}>
            {myProfile?.businessName || companyName}
          </span>
        </div>

        <nav className={styles.sbNav}>
          {["main", "tools", "account"].map((section) => (
            <div key={section}>
              <div className={styles.sbSection}>{section}</div>
              {NAV.filter(
                (n) =>
                  n.section === section && (!n.hodOnly || myProfile?.isHod),
              ).map((n) => (
                <div
                  key={n.label}
                  className={`${styles.sbItem} ${activeNav === n.label && !n.isFullPage ? styles.active : ""}`}
                  onClick={() => {
                    if (n.isFullPage) {
                      navigate("/my-accounts", {
                        state: { returnPath: "/my-dashboard", activeNav },
                      });
                      return;
                    }
                    setActiveNav(n.label);
                  }}
                >
                  <i className={`ti ${n.icon}`} aria-hidden="true" />
                  {n.label}
                  {n.label === "Notifications" && unreadCount > 0 && (
                    <span className={styles.sbBadge}>{unreadCount}</span>
                  )}
                  {n.label === "My Profile" &&
                    pendingProfileEdits.length > 0 && (
                      <span className={styles.sbBadge}>
                        {pendingProfileEdits.length}
                      </span>
                    )}
                  {n.label === "Cover Requests" &&
                    coverRequestsPendingCount > 0 && (
                      <span className={styles.sbBadge}>
                        {coverRequestsPendingCount}
                      </span>
                    )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sbFooter}>
          <div className={styles.sbUser}>
            <div className={styles.sbAvatar}>
              {myProfile?.profilePictureUrl ? (
                <img
                  src={myProfile.profilePictureUrl}
                  alt=""
                  className={styles.sbAvatarImg}
                />
              ) : (
                initials(myFirst, myLast)
              )}
            </div>
            <div className={styles.sbUserRow}>
              <div>
                <div className={styles.sbUserName}>
                  {loadingMyProfile ? "Loading…" : myFirst}
                </div>
                <div className={styles.sbUserRole}>
                  {myProfile?.isHod ? "Employee · HOD" : "Employee"}
                </div>
              </div>
              <button
                type="button"
                className={styles.sbLogoutBtn}
                onClick={handleLogout}
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
      <div className={styles.main}>
        {/* Topbar */}
        <div className={styles.topbar}>
          <div className={styles.empTopbarHeading}>
            <h1 className={styles.empGreeting}>
              <i
                className={`ti ${greeting.icon} ${styles.empGreetingIcon}`}
                aria-hidden="true"
              />
              <span>
                {greeting.text}
                {!loadingMyProfile && myFirst && `, ${myFirst}`}
              </span>
            </h1>
            <p className={styles.empGreetingSub}>
              <span className={styles.empGreetingDate}>{today}</span>
              <span className={styles.empGreetingDivider} aria-hidden="true" />
              <span className={styles.empWorkspaceTag}>
                <span className={styles.empWorkspaceLogo}>
                  {myProfile?.businessLogo ? (
                    <img
                      src={myProfile.businessLogo}
                      alt=""
                      className={styles.empWorkspaceLogoImg}
                    />
                  ) : (
                    <i className="ti ti-building" aria-hidden="true" />
                  )}
                </span>
                {loadingSummary ? "Loading…" : companyName}
              </span>
            </p>
          </div>

          <div className={styles.topbarRight}>
            {/* ── Message shortcut — jumps straight to the Messages tab ── */}
            <div
              className={styles.notifBtn}
              onClick={() => setActiveNav("Messages")}
              aria-label="Messages"
              title="Messages"
            >
              <i
                className="ti ti-message-circle"
                style={{ fontSize: 17 }}
                aria-hidden="true"
              />
            </div>

            {/* ── Bell button + dropdown panel ── */}
            <div className={styles.notifWrapper} ref={notifRef}>
              <div
                className={styles.notifBtn}
                onClick={openNotifPanel}
                aria-label="Notifications"
                title="Notifications"
              >
                <i
                  className="ti ti-bell"
                  style={{ fontSize: 17 }}
                  aria-hidden="true"
                />
                {unreadCount > 0 && (
                  <span className={styles.notifCount}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>

              {notifOpen && (
                <div className={styles.notifPanel}>
                  <div className={styles.notifPanelHdr}>
                    <span className={styles.notifPanelTitle}>
                      Notifications
                      {unreadCount > 0 && (
                        <span
                          style={{
                            marginLeft: 6,
                            background: "var(--accent)",
                            color: "#fff",
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontWeight: 600,
                          }}
                        >
                          {unreadCount} new
                        </span>
                      )}
                    </span>
                    <button
                      className={styles.notifMarkAll}
                      onClick={markAllRead}
                      disabled={unreadCount === 0}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className={styles.notifList}>
                    {loadingNotifs ? (
                      <p className={styles.notifEmpty}>Loading…</p>
                    ) : notifs.length === 0 ? (
                      <div className={styles.notifEmpty}>
                        <div className={styles.notifEmptyIcon}>🔔</div>
                        <p>You're all caught up!</p>
                      </div>
                    ) : (
                      notifs.map((notif) => {
                        const isPending =
                          notif.type === "EMPLOYEE_REGISTRATION" &&
                          !notif.isRead;
                        const isActioning = actioningNotif === notif.id;

                        return (
                          <div
                            key={notif.id}
                            className={`${styles.notifItem} ${!notif.isRead ? styles.unread : ""}`}
                            onClick={() => {
                              if (!notif.isRead) markOneRead(notif.id);
                            }}
                          >
                            <div className={styles.notifItemTop}>
                              <div
                                className={
                                  NOTIF_ICON_CLASS[notif.type] ??
                                  styles.notifIcon + " " + styles.sys
                                }
                              >
                                <i
                                  className={`ti ${NOTIF_ICON[notif.type] ?? "ti-bell"}`}
                                  style={{ fontSize: 14 }}
                                  aria-hidden="true"
                                />
                              </div>

                              <div className={styles.notifBody}>
                                <div className={styles.notifTitle}>
                                  {notif.title}
                                </div>
                                <div className={styles.notifMsg}>
                                  {notif.message}
                                </div>
                                <div className={styles.notifTime}>
                                  {timeAgo(notif.createdAt)}
                                </div>
                              </div>

                              <div className={styles.notifItemRight}>
                                {!notif.isRead && (
                                  <div className={styles.notifUnreadDot} />
                                )}
                                <button
                                  type="button"
                                  className={styles.notifDeleteBtn}
                                  aria-label="Delete notification"
                                  title="Delete notification"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotif(notif);
                                  }}
                                >
                                  <i
                                    className="ti ti-trash"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </div>

                            {isPending && notif.employeeId && (
                              <div
                                className={styles.notifActions}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className={styles.notifApproveBtn}
                                  disabled={isActioning}
                                  onClick={() => approveFromNotif(notif)}
                                >
                                  <i
                                    className="ti ti-check"
                                    style={{ fontSize: 11 }}
                                  />
                                  {isActioning ? "…" : "Approve"}
                                </button>
                                <button
                                  className={styles.notifRejectBtn}
                                  disabled={isActioning}
                                  onClick={() => rejectFromNotif(notif)}
                                >
                                  <i
                                    className="ti ti-x"
                                    style={{ fontSize: 11 }}
                                  />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <UndoBar
                    pendingDeletes={pendingDeletes}
                    onUndo={undoDelete}
                  />
                </div>
              )}
            </div>

            {/* ── Settings icon (theme toggle) ── */}
            <ThemeToggleMenu />
          </div>
        </div>

        {/* Content area */}
        <div
          className={
            activeNav === "Messages" ||
            activeNav === "Workforce" ||
            activeNav === "Attendance" ||
            activeNav === "Leave" ||
            activeNav === "Cover Requests" ||
            activeNav === "Departments" ||
            activeNav === "My Profile" ||
            activeNav === "Notifications"
              ? styles.contentFull
              : styles.content
          }
        >
          {activeNav === "Notifications" ? (
            <NotificationsPage
              notifs={notifs}
              loading={loadingNotifs}
              unreadCount={unreadCount}
              actioningNotif={actioningNotif}
              onMarkAllRead={markAllRead}
              onMarkOneRead={markOneRead}
              onApprove={approveFromNotif}
              onReject={rejectFromNotif}
              pendingDeletes={pendingDeletes}
              onDelete={deleteNotif}
              onUndo={undoDelete}
            />
          ) : (activeNav === "Departments" || activeNav === "Workforce") &&
            myProfile?.isHod ? (
            <HodWorkforceTab />
          ) : activeNav === "Messages" ? (
            <EmployeeInbox onUnreadCountChange={() => {}} />
          ) : activeNav === "Leave" ? (
            <EmployeeLeaveTab isHod={myProfile?.isHod} />
          ) : activeNav === "Cover Requests" ? (
            <CoverRequestsTab />
          ) : activeNav === "Attendance" ? (
            <EmployeeAttendanceTab />
          ) : activeNav === "Penalty" ? (
            <EmployeePenaltyTab />
          ) : activeNav === "My Profile" ? (
            <MyProfileTab profile={myProfile} isHod={myProfile?.isHod} />
          ) : (
            <>
              {summaryError && (
                <div
                  className={styles.invitePanel}
                  style={{
                    background: "var(--danger-bg)",
                    borderColor: "var(--danger-border)",
                  }}
                >
                  <i
                    className="ti ti-alert-circle"
                    style={{
                      fontSize: 18,
                      color: "var(--danger-text)",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--danger-text)",
                      flex: 1,
                    }}
                  >
                    Couldn't load dashboard data. Check that the backend is
                    running and you're logged in.
                  </span>
                  <button
                    className={`${styles.invActionBtn} ${styles.invCopy}`}
                    onClick={fetchSummary}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* My attendance + payroll — this replaces the employer's
                  business-wide "Today's Pulse" widget, which never
                  belonged on an employee's own dashboard. */}
              <div className={styles.statsGrid}>
                {[
                  {
                    icon: "ti-calendar-check",
                    color: "teal",
                    num: loadingMyAttendance
                      ? "—"
                      : (ATTENDANCE_LABEL[myAttendanceToday?.status] ??
                        "Not yet"),
                    label: "Today's attendance",
                    trend: loadingMyAttendance
                      ? "Loading…"
                      : myAttendanceToday?.clockIn
                        ? `In at ${new Date(myAttendanceToday.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Not clocked in yet",
                    trendColor: "var(--accent-hover)",
                  },
                  {
                    icon: "ti-calendar-stats",
                    color: "blue",
                    num: loadingMyAttendance
                      ? "—"
                      : myAttendanceThisWeek.present,
                    label: "Present this week",
                    trend: loadingMyAttendance
                      ? "Loading…"
                      : `${myAttendanceThisWeek.late} late · ${myAttendanceThisWeek.absent} absent`,
                    trendColor: "var(--info-text)",
                  },
                  {
                    icon: "ti-cash-banknote",
                    color: "amber",
                    num:
                      loadingMyPayroll || !myPayroll?.canViewPay
                        ? "—"
                        : money(myPayroll?.netPay),
                    label: "Net pay (this period)",
                    trend: loadingMyPayroll
                      ? "Loading…"
                      : myPayroll?.finalized
                        ? "Finalized"
                        : "Still in progress",
                    trendColor: "var(--warning-text)",
                  },
                  {
                    icon: "ti-discount-2",
                    color: "coral",
                    num: loadingMyPayroll
                      ? "—"
                      : money(myPayroll?.totalDeduction),
                    label: "Deductions (this period)",
                    trend: loadingMyPayroll
                      ? "Loading…"
                      : `${myPayroll?.pardonedCount ?? 0} pardoned`,
                    trendColor: "var(--danger-text)",
                  },
                ].map((s) => (
                  <div key={s.label} className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles[s.color]}`}>
                      <i
                        className={`ti ${s.icon}`}
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className={styles.statNum}>{s.num}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                    <div
                      className={styles.statTrend}
                      style={{ color: s.trendColor }}
                    >
                      <i
                        className="ti ti-trending-up"
                        style={{ fontSize: 12 }}
                        aria-hidden="true"
                      />{" "}
                      {s.trend}
                    </div>
                  </div>
                ))}
              </div>

              {/* My attendance detail + My payroll detail */}
              <div className={styles.row2}>
                <div className={styles.panel}>
                  <div className={styles.panelHdr}>
                    <span className={styles.panelTitle}>My attendance</span>
                    <span
                      className={styles.panelAction}
                      onClick={() => setActiveNav("Attendance")}
                    >
                      View all
                    </span>
                  </div>
                  <div style={{ padding: "4px 16px 16px" }}>
                    {loadingMyAttendance ? (
                      <p className={styles.emptyState}>Loading…</p>
                    ) : myAttendanceToday ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 16,
                          alignItems: "center",
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                      >
                        <span>
                          <i className="ti ti-login-2" aria-hidden="true" /> In:{" "}
                          {myAttendanceToday.clockIn
                            ? new Date(
                                myAttendanceToday.clockIn,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                        <span>
                          <i className="ti ti-logout" aria-hidden="true" /> Out:{" "}
                          {myAttendanceToday.clockOut
                            ? new Date(
                                myAttendanceToday.clockOut,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                        <span
                          className={`${styles.statusPill} ${styles[ATTENDANCE_PILL[myAttendanceToday.status]] ?? ""}`}
                        >
                          {ATTENDANCE_LABEL[myAttendanceToday.status] ??
                            myAttendanceToday.status}
                        </span>
                      </div>
                    ) : (
                      <p className={styles.emptyState}>
                        You haven't clocked in yet today.
                      </p>
                    )}
                    <button
                      type="button"
                      className={styles.qaBtn}
                      style={{ marginTop: 14 }}
                      onClick={() => navigate("/my-attendance")}
                    >
                      <span className={`${styles.qaIconWrap} ${styles.teal}`}>
                        <i className="ti ti-scan" aria-hidden="true" />
                      </span>
                      Scan to clock in / out
                    </button>
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelHdr}>
                    <span className={styles.panelTitle}>My payroll</span>
                    <span
                      className={styles.panelAction}
                      onClick={() => setActiveNav("Penalty")}
                    >
                      View details
                    </span>
                  </div>
                  <div style={{ padding: "4px 16px 16px" }}>
                    {loadingMyPayroll ? (
                      <p className={styles.emptyState}>Loading…</p>
                    ) : (
                      <>
                        <p
                          style={{
                            margin: "0 0 12px",
                            fontSize: 12.5,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {myPayroll?.periodStart && myPayroll?.periodEnd
                            ? `Period: ${new Date(myPayroll.periodStart).toLocaleDateString([], { day: "numeric", month: "short" })} – ${new Date(myPayroll.periodEnd).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`
                            : "Current pay period"}
                        </p>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                            fontSize: 13,
                            color: "var(--text-primary)",
                          }}
                        >
                          <span>
                            Base salary:{" "}
                            <strong>
                              {myPayroll?.canViewPay
                                ? money(myPayroll?.baseSalary)
                                : "Hidden"}
                            </strong>
                          </span>
                          <span>
                            Net pay:{" "}
                            <strong>
                              {myPayroll?.canViewPay
                                ? money(myPayroll?.netPay)
                                : "Hidden"}
                            </strong>
                          </span>
                          <span>
                            Total deducted:{" "}
                            <strong>{money(myPayroll?.totalDeduction)}</strong>
                          </span>
                          <span>
                            Pardoned:{" "}
                            <strong>{myPayroll?.pardonedCount ?? 0}</strong>
                          </span>
                          <span>
                            Late: <strong>{myPayroll?.lateCount ?? 0}</strong>
                          </span>
                          <span>
                            Absent:{" "}
                            <strong>{myPayroll?.absentCount ?? 0}</strong>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions + Recent activity */}
              <div className={styles.row2}>
                <div className={`${styles.panel} ${styles.qaPanel}`}>
                  <div className={`${styles.panelHdr} ${styles.qaPanelHdr}`}>
                    <span className={styles.panelTitle}>Quick actions</span>
                  </div>
                  <div className={styles.qaScrollWrap}>
                    <div className={styles.qaGrid} ref={qaScrollRef}>
                      {[
                        {
                          icon: "ti-scan",
                          label: "Scan attendance",
                          color: "teal",
                          action: () => navigate("/my-attendance"),
                        },
                        {
                          icon: "ti-calendar-plus",
                          label: "Request leave",
                          color: "blue",
                          action: () => setActiveNav("Leave"),
                        },
                        {
                          icon: "ti-user-shield",
                          label: "Cover requests",
                          color: "teal",
                          action: () => setActiveNav("Cover Requests"),
                        },
                        {
                          icon: "ti-receipt",
                          label: "View payslip",
                          color: "amber",
                          action: () => setActiveNav("Penalty"),
                        },
                        {
                          icon: "ti-user-edit",
                          label: "Edit my profile",
                          color: "coral",
                          action: () => setActiveNav("My Profile"),
                        },
                      ].map((q) => (
                        <button
                          key={q.label}
                          className={styles.qaBtn}
                          onClick={q.action}
                        >
                          <span
                            className={`${styles.qaIconWrap} ${styles[q.color]}`}
                          >
                            <i className={`ti ${q.icon}`} aria-hidden="true" />
                          </span>
                          {q.label}
                        </button>
                      ))}
                    </div>
                    <div className={styles.qaScrollTrack} aria-hidden="true">
                      <div
                        className={styles.qaScrollThumb}
                        style={{
                          width: `${qaThumb.width}%`,
                          left: `${qaThumb.left}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Recent activity — driven by real notifications. Hidden on
                    phones, where the notification bell already surfaces
                    this same feed. */}
                <div
                  className={`${styles.panel} ${styles.recentActivityPanel}`}
                >
                  <button
                    type="button"
                    className={styles.panelHdrToggle}
                    onClick={() => setRecentActivityOpen((o) => !o)}
                    aria-expanded={recentActivityOpen}
                  >
                    <span className={styles.panelHdr}>
                      <span className={styles.panelTitle}>Recent activity</span>
                      <span className={styles.panelHdrRight}>
                        <span
                          className={styles.panelAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            openNotifPanel();
                          }}
                        >
                          View all
                        </span>
                        <i
                          className={`ti ${recentActivityOpen ? "ti-chevron-up" : "ti-chevron-down"} ${styles.panelChevron}`}
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </button>
                  {recentActivityOpen && (
                    <div className={styles.activityList}>
                      {notifs.length === 0 ? (
                        <p className={styles.emptyState}>No activity yet.</p>
                      ) : (
                        notifs.slice(0, 4).map((notif) => {
                          const dotClass =
                            {
                              EMPLOYEE_REGISTRATION: "req",
                              EMPLOYEE_APPROVED: "in",
                              EMPLOYEE_REJECTED: "out",
                              SYSTEM: "inv",
                            }[notif.type] ?? "inv";

                          return (
                            <div key={notif.id} className={styles.actItem}>
                              <div
                                className={`${styles.actDot} ${styles[`dot_${dotClass}`]}`}
                              >
                                <i
                                  className={`ti ${NOTIF_ICON[notif.type] ?? "ti-bell"}`}
                                  style={{ fontSize: 13 }}
                                  aria-hidden="true"
                                />
                              </div>
                              <div className={styles.actBody}>
                                <div className={styles.actText}>
                                  {notif.message}
                                </div>
                                <div className={styles.actTime}>
                                  {timeAgo(notif.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────────────────
          Every destination lives in one horizontally scrollable strip —
          swipe sideways to reach items past the visible edge, same as a
          native app's scrollable tab bar. Hidden entirely on desktop. */}
      <nav className={styles.bottomNav} aria-label="Primary">
        <div className={styles.bottomNavScroll} ref={bottomNavScrollRef}>
          {NAV.filter(
            (n) =>
              (!n.hodOnly || myProfile?.isHod) &&
              // Notifications and Messages stay reachable on mobile via the
              // topbar bell icon / elsewhere, but are dropped from this
              // strip specifically.
              n.label !== "Notifications" &&
              n.label !== "Messages",
          ).map((n) => (
            <button
              key={n.label}
              type="button"
              className={`${styles.bottomNavItem} ${activeNav === n.label && !n.isFullPage ? styles.bottomNavActive : ""}`}
              onClick={() =>
                n.isFullPage
                  ? navigate("/my-accounts", {
                      state: { returnPath: "/my-dashboard", activeNav },
                    })
                  : setActiveNav(n.label)
              }
            >
              <div className={styles.bottomNavIconWrap}>
                <i className={`ti ${n.icon}`} aria-hidden="true" />
                {n.label === "My Profile" && pendingProfileEdits.length > 0 && (
                  <span className={styles.bottomNavDot} />
                )}
                {n.label === "Cover Requests" &&
                  coverRequestsPendingCount > 0 && (
                    <span className={styles.bottomNavDot} />
                  )}
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
            className={styles.bottomNavItem}
            onClick={() => setShowLogoutConfirm(true)}
          >
            <div className={styles.bottomNavIconWrap}>
              <i className="ti ti-logout" aria-hidden="true" />
            </div>
            <span>Log out</span>
          </button>
        </div>
        <div className={styles.bottomNavScrollTrack} aria-hidden="true">
          <div
            className={styles.bottomNavScrollThumb}
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

// ── Notifications (full page) ───────────────────────────────────────────
// This is the sidebar "Notifications" tab — a dedicated page listing every
// notification, distinct from the bell icon's quick dropdown panel.
// ── Undo bar ─────────────────────────────────────────────────────────────
// Sits under the notification list (bell dropdown or full page) whenever
// one or more deletes are pending. The thin progress line shows exactly
// how much of the 3s grace window is left; its `key` forces the shrink
// animation to restart whenever a new delete is added to the batch.
function UndoBar({ pendingDeletes, onUndo, fixed = false }) {
  if (!pendingDeletes || pendingDeletes.length === 0) return null;
  const count = pendingDeletes.length;
  const latestId = pendingDeletes[pendingDeletes.length - 1].id;

  return (
    <div
      className={`${styles.undoBar} ${fixed ? styles.undoBarFixed : styles.undoBarPanel}`}
    >
      <div key={`${latestId}-${count}`} className={styles.undoBarProgress} />
      <i className="ti ti-trash" aria-hidden="true" />
      <span className={styles.undoBarText}>
        {count === 1
          ? "Notification deleted"
          : `${count} notifications deleted`}
      </span>
      <button
        type="button"
        className={styles.undoBarBtn}
        onClick={() => pendingDeletes.forEach((p) => onUndo(p.id))}
      >
        Undo
      </button>
    </div>
  );
}

function NotificationsPage({
  notifs,
  loading,
  unreadCount,
  actioningNotif,
  onMarkAllRead,
  onMarkOneRead,
  onApprove,
  onReject,
  pendingDeletes,
  onDelete,
  onUndo,
}) {
  return (
    <div className={styles.notifPageWrap}>
      <div className={styles.notifPageHdr}>
        <span className={styles.notifPageTitle}>
          Notifications
          {unreadCount > 0 && (
            <span className={styles.notifPageBadge}>{unreadCount} new</span>
          )}
        </span>
        <button
          className={styles.notifMarkAll}
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          Mark all read
        </button>
      </div>

      <div className={styles.notifPageList}>
        {loading ? (
          <p className={styles.notifEmpty}>Loading…</p>
        ) : notifs.length === 0 ? (
          <div className={styles.notifEmpty}>
            <div className={styles.notifEmptyIcon}>🔔</div>
            <p>You're all caught up!</p>
          </div>
        ) : (
          notifs.map((notif) => {
            const isPending =
              notif.type === "EMPLOYEE_REGISTRATION" && !notif.isRead;
            const isActioning = actioningNotif === notif.id;

            return (
              <div
                key={notif.id}
                className={`${styles.notifItem} ${!notif.isRead ? styles.unread : ""}`}
                onClick={() => {
                  if (!notif.isRead) onMarkOneRead(notif.id);
                }}
              >
                <div className={styles.notifItemTop}>
                  <div
                    className={
                      NOTIF_ICON_CLASS[notif.type] ??
                      styles.notifIcon + " " + styles.sys
                    }
                  >
                    <i
                      className={`ti ${NOTIF_ICON[notif.type] ?? "ti-bell"}`}
                      style={{ fontSize: 14 }}
                      aria-hidden="true"
                    />
                  </div>

                  <div className={styles.notifBody}>
                    <div className={styles.notifTitle}>{notif.title}</div>
                    <div className={styles.notifMsg}>{notif.message}</div>
                    <div className={styles.notifTime}>
                      {timeAgo(notif.createdAt)}
                    </div>
                  </div>

                  <div className={styles.notifItemRight}>
                    {!notif.isRead && <div className={styles.notifUnreadDot} />}
                    <button
                      type="button"
                      className={styles.notifDeleteBtn}
                      aria-label="Delete notification"
                      title="Delete notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notif);
                      }}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isPending && notif.employeeId && (
                  <div
                    className={styles.notifActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={styles.notifApproveBtn}
                      disabled={isActioning}
                      onClick={() => onApprove(notif)}
                    >
                      <i className="ti ti-check" style={{ fontSize: 11 }} />
                      {isActioning ? "…" : "Approve"}
                    </button>
                    <button
                      className={styles.notifRejectBtn}
                      disabled={isActioning}
                      onClick={() => onReject(notif)}
                    >
                      <i className="ti ti-x" style={{ fontSize: 11 }} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <UndoBar pendingDeletes={pendingDeletes} onUndo={onUndo} fixed />
    </div>
  );
}
