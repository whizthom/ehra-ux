import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { getDepartments } from "../api/departmentApi";
import {
  getPendingEmployerDecisions,
  approveLeave,
  rejectLeave,
} from "../api/leaveApi";
import { getTodayAttendance } from "../api/attendanceApi";
import { softDeleteEmployee } from "../api/workforceApi";
import useMessageStream from "../hooks/useMessageStream";
import styles from "./Dashboard.module.css";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import AddDepartmentModal from "../components/AddDepartmentModal";
import RemoveEmployeeModal from "../components/RemoveEmployeeModal";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import QuickSendMessageModal from "../components/QuickSendMessageModal";
import BusinessReportModal from "../components/BusinessReportModal";
import AttendanceSection from "../components/AttendanceSection";
import QrCodeTab from "../components/QrcodeTab";
import WorkforceTab from "../components/WorkforceTab";
import MessagesTab from "../components/MessagesTab";
import LeavesTab from "../components/LeavesTab";
import DepartmentsTab from "../components/DepartmentsTab";
import ProfileEditApprovalPanel from "../components/ProfileEditApprovalPanel";
import BusinessSettingsTab from "../components/BusinessSettingsTab";
import PenaltyTab from "../components/PenaltyTab";
import ReportsTab from "../components/ReportsTab";
import TodaysPulse from "../components/TodaysPulse";
import {
  getAllProfileEdits,
  getPendingProfileEdits,
  submitEmployerDecision,
} from "../api/profileEditApi";
import {
  getMyBusinessProfile,
  updateBusinessProfile,
  getAttendanceProfileSetting,
  updateAttendanceProfileSetting,
} from "../api/businessApi";
import { getMyProfile } from "../api/employeeApi";

// ── Sidebar nav ────────────────────────────────────────────────────────────
// "My Accounts" is handled specially — clicking it navigates to the
// full-page My Accounts route (see MyAccountsPage) instead of switching
// the main content area, since it's an identity-level concern (switch
// workspace / add a business) rather than a business-scoped tab.
const NAV = [
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

    // Icon-font/content can still be settling in right after mount
    // (webfont swap, images, dynamic pill count), which can leave the
    // very first measurement wrong — one more pass shortly after fixes
    // that without needing a visible flash.
    const settle = setTimeout(update, 400);

    // Also watch the row itself: its scrollWidth can change later on
    // (e.g. the invite-link card above pushing layout, a pill being
    // added/removed) without the window ever resizing.
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(settle);
      if (observer) observer.disconnect();
    };
  }, [ref]);

  return thumb;
}

// Tracks whether the viewport is at or below the mobile/tablet breakpoint
// (the same 900px threshold the sidebar/bottom-nav switch already uses) —
// for the handful of cases where mobile needs genuinely different
// *behavior*, not just different CSS (e.g. the bell going straight to the
// full Notifications page instead of opening its dropdown).
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

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
  // If we arrived here via navigate(..., { state: { activeNav } }) — e.g.
  // the "Back to workforce" button on an employee's profile page — open
  // directly on that tab instead of always resetting to "Dashboard".
  const [activeNav, setActiveNav] = useState(
    location.state?.activeNav || "Dashboard",
  );
  const isMobile = useIsMobile();

  // Latest attendance (today's clock-ins/outs, shown on the main dashboard)
  const [latestAttendance, setLatestAttendance] = useState([]);
  const [loadingLatestAttendance, setLoadingLatestAttendance] = useState(true);
  const [removeConfirm, setRemoveConfirm] = useState(null); // { id, name }
  const [removingId, setRemovingId] = useState(null);

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

  // Employee directory (raw data — still needed by AddDepartmentModal;
  // the table itself now lives in the Workforce tab, not the dashboard)
  const [employees, setEmployees] = useState([]);
  const [loadingDir, setLoadingDir] = useState(true);

  // Pending approvals (table on main page)
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  // Pending leave requests (table on main page)
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loadingPendingLeaves, setLoadingPendingLeaves] = useState(true);
  const [actioningLeaveId, setActioningLeaveId] = useState(null);

  // Invite link
  const [inviteLink, setInviteLink] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteClosing, setInviteClosing] = useState(false);

  // Departments
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [reportSummaryOpen, setReportSummaryOpen] = useState(false);
  const [recentActivityOpen, setRecentActivityOpen] = useState(false);
  const [pendingApprovalsOpen, setPendingApprovalsOpen] = useState(false);
  const [pendingLeavesOpen, setPendingLeavesOpen] = useState(false);

  // Profile edit requests — employer approval queue (final sign-off after
  // the HOD, or first stop if the employee has no HOD).
  const [profileEdits, setProfileEdits] = useState([]);
  const [pendingProfileEdits, setPendingProfileEdits] = useState([]);
  const [loadingProfileEdits, setLoadingProfileEdits] = useState(true);

  // Business (company) profile — Settings tab
  const [businessProfile, setBusinessProfile] = useState(null);
  const [loadingBusinessProfile, setLoadingBusinessProfile] = useState(true);

  // Personal attendance profile — Settings tab. Off by default; toggling
  // this changes whether the employer counts as staff and is subject to
  // clock-in/out (see BusinessSettingsTab).
  const [attendanceProfile, setAttendanceProfile] = useState(null);
  const [loadingAttendanceProfile, setLoadingAttendanceProfile] =
    useState(true);

  // The employer's own profile (auto-created Employee row, role ADMIN) —
  // Settings tab "My Profile". Edits here save instantly, no approval.
  const [myProfile, setMyProfile] = useState(null);
  const [loadingMyProfile, setLoadingMyProfile] = useState(true);

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

  const fetchDirectory = useCallback(async () => {
    try {
      setLoadingDir(true);
      const { data } = await API.get("/employees/directory");
      setEmployees(data);
    } catch (err) {
      console.error("Failed to load employee directory:", err);
    } finally {
      setLoadingDir(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      setLoadingPending(true);
      const { data } = await API.get("/employees/pending");
      setPending(data);
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoadingDepts(true);
      const { data } = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to load departments:", err);
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  const fetchPendingLeaves = useCallback(async () => {
    try {
      setLoadingPendingLeaves(true);
      const { data } = await getPendingEmployerDecisions();
      setPendingLeaves(data);
    } catch (err) {
      console.error("Failed to load pending leave requests:", err);
    } finally {
      setLoadingPendingLeaves(false);
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

  // Business (company) profile
  const fetchBusinessProfile = useCallback(async () => {
    try {
      setLoadingBusinessProfile(true);
      const { data } = await getMyBusinessProfile();
      setBusinessProfile(data);
    } catch (err) {
      console.error("Failed to load business profile:", err);
    } finally {
      setLoadingBusinessProfile(false);
    }
  }, []);

  // Personal attendance profile
  const fetchAttendanceProfile = useCallback(async () => {
    try {
      setLoadingAttendanceProfile(true);
      const { data } = await getAttendanceProfileSetting();
      setAttendanceProfile(data);
    } catch (err) {
      console.error("Failed to load personal attendance profile setting:", err);
    } finally {
      setLoadingAttendanceProfile(false);
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

  // Today's attendance feed shown on the main Dashboard view — replaces
  // the old static employee directory with a live "who clocked in/out
  // today" list, since that's the more relevant thing for a daily landing page.
  const fetchLatestAttendance = useCallback(async () => {
    try {
      setLoadingLatestAttendance(true);
      const { data } = await getTodayAttendance();
      setLatestAttendance(data);
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    } finally {
      setLoadingLatestAttendance(false);
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

  // Keeps the mobile "Today's Pulse" widget's "live" badge honest — it
  // isn't just decorative, today's attendance really does get re-polled
  // periodically while the dashboard is open.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLatestAttendance();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchLatestAttendance]);

  // Pending approvals / pending leave requests stay collapsed by default —
  // opening automatically only once there's actually something to review.
  useEffect(() => {
    if (!loadingPending && pending.length > 0) setPendingApprovalsOpen(true);
  }, [loadingPending, pending.length]);

  useEffect(() => {
    if (!loadingPendingLeaves && pendingLeaves.length > 0)
      setPendingLeavesOpen(true);
  }, [loadingPendingLeaves, pendingLeaves.length]);

  useEffect(() => {
    fetchSummary();
    fetchNotifs();
    fetchDirectory();
    fetchPending();
    fetchDepartments();
    fetchPendingLeaves();
    fetchLatestAttendance();
    fetchProfileEdits();
    fetchBusinessProfile();
    fetchAttendanceProfile();
    fetchMyProfile();
  }, [
    fetchSummary,
    fetchNotifs,
    fetchDirectory,
    fetchPending,
    fetchDepartments,
    fetchPendingLeaves,
    fetchLatestAttendance,
    fetchProfileEdits,
    fetchBusinessProfile,
    fetchAttendanceProfile,
    fetchMyProfile,
  ]);

  // ── Real-time: prepend new notifications without reloading ─────────────
  useMessageStream({
    onLeaveUpdate: (leave) => {
      setPendingLeaves((prev) => {
        if (leave.status === "PENDING_EMPLOYER") {
          const exists = prev.some((l) => l.id === leave.id);
          if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
          return [leave, ...prev];
        }
        return prev.filter((l) => l.id !== leave.id);
      });
    },

    onNewNotification: (payload) => {
      if (payload.type === "ADMIN_MESSAGE") return;
      setNotifs((prev) => {
        if (prev.some((n) => n.id === payload.id)) return prev;
        return [payload, ...prev];
      });
      if (payload.type === "LEAVE_POLICY_UPDATED") {
        fetchPendingLeaves();
      }
      if (payload.type === "PROFILE_EDIT_AWAITING_EMPLOYER") {
        fetchProfileEdits();
      }
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
    fetchDirectory();
  };

  const handleSaveBusinessProfile = async (form) => {
    const { data } = await updateBusinessProfile(form);
    setBusinessProfile(data);
  };

  const handleToggleAttendanceProfile = async (enabled) => {
    const { data } = await updateAttendanceProfileSetting(enabled);
    setAttendanceProfile(data);
    // Staff counts (dashboard totals) and the Workforce grid both change
    // depending on this setting — refresh them so the UI reflects it
    // immediately instead of waiting for the next natural refetch.
    fetchSummary();
    fetchDirectory();
    return data;
  };

  const handleLogoUploaded = async () => {
    await fetchBusinessProfile();
  };

  const openNotifPanel = () => {
    if (isMobile) {
      // Mobile/tablet: the bell is a shortcut straight to the full
      // Notifications page — the small dropdown doesn't get its own
      // trigger there, it's a desktop-only convenience.
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
    () =>
      Promise.all([
        fetchSummary(),
        fetchNotifs(),
        fetchPending(),
        fetchDirectory(),
      ]),
    [fetchSummary, fetchNotifs, fetchPending, fetchDirectory],
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

  const approveEmployee = async (id) => {
    try {
      setActioningId(id);
      await API.post(`/employees/${id}/approve`);
      await refreshAll();
    } catch {
      alert("Unable to approve this registration. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  const rejectEmployee = async (id) => {
    const emp = pending.find((e) => e.id === id);
    const name = fullName(emp?.firstName, emp?.lastName);
    if (
      !window.confirm(
        `Reject ${name}'s registration? They will need a new invite to try again.`,
      )
    )
      return;
    try {
      setActioningId(id);
      await API.post(`/employees/${id}/reject`);
      await refreshAll();
    } catch {
      alert("Unable to reject this registration. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  const approveLeaveRequest = async (id) => {
    try {
      setActioningLeaveId(id);
      await approveLeave(id);
      await fetchPendingLeaves();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Unable to approve this leave request.";
      alert(
        typeof msg === "string" ? msg : "Unable to approve this leave request.",
      );
    } finally {
      setActioningLeaveId(null);
    }
  };

  const rejectLeaveRequest = async (id) => {
    const leave = pendingLeaves.find((l) => l.id === id);
    const name = fullName(leave?.employeeFirstName, leave?.employeeLastName);
    if (!window.confirm(`Reject ${name}'s leave request?`)) return;
    try {
      setActioningLeaveId(id);
      await rejectLeave(id);
      await fetchPendingLeaves();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Unable to reject this leave request.";
      alert(
        typeof msg === "string" ? msg : "Unable to reject this leave request.",
      );
    } finally {
      setActioningLeaveId(null);
    }
  };

  // ── Latest attendance panel actions ────────────────────────────────────

  const handleViewEmployee = (employeeId) => {
    navigate(`/employees/${employeeId}`);
  };

  const handleRequestRemove = (row) => {
    setRemoveConfirm({
      id: row.employeeId,
      firstName: row.employeeFirstName,
      lastName: row.employeeLastName,
    });
  };

  const handleConfirmRemove = async () => {
    if (!removeConfirm) return;
    setRemovingId(removeConfirm.id);
    try {
      await softDeleteEmployee(removeConfirm.id);
      setLatestAttendance((prev) =>
        prev.filter((r) => r.employeeId !== removeConfirm.id),
      );
      await Promise.all([fetchDirectory(), fetchSummary()]);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Unable to remove this employee. Please try again.";
      alert(
        typeof msg === "string"
          ? msg
          : "Unable to remove this employee. Please try again.",
      );
    } finally {
      setRemovingId(null);
      setRemoveConfirm(null);
    }
  };

  const generateInviteLink = async () => {
    try {
      setLoadingInvite(true);
      const { data } = await API.post("/invitations/generate");
      setInviteLink(data.invitationLink);
    } catch {
      alert("Unable to generate invitation link. Please try again.");
    } finally {
      setLoadingInvite(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Lets the user cancel the invite-link card off the screen once
  // they're done with it: plays a brief exit animation, then actually
  // clears the link once it's finished sliding/fading away.
  const dismissInviteLink = () => {
    setInviteClosing(true);
    setTimeout(() => {
      setInviteLink("");
      setCopied(false);
      setInviteClosing(false);
    }, 200);
  };

  const handleDepartmentCreated = (newDept) => {
    setDepartments((prev) => [...prev, newDept]);
  };

  // ── Derived ───────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const adminFirst = summary?.adminFirstName ?? "Admin";
  const adminLast = summary?.adminLastName ?? "";
  const companyName = summary?.companyName ?? "Your Company";
  const unreadCount = (notifs || []).filter((n) => !n?.isRead).length;

  const safeSummary = summary ?? {
    totalEmployees: 0,
    activeEmployees: 0,
    pendingApprovals: 0,
  };

  // Generated invite link card — pulled out so it can be rendered in two
  // spots: its usual place near the top of the page (desktop/tablet),
  // and again right under the Quick actions row on phones, directly
  // beneath the "Invite employee" pill that triggers it, so the result
  // shows up exactly where the tap happened instead of off-screen above.
  const inviteLinkPanel = inviteLink ? (
    <div
      className={`${styles.invitePanel} ${inviteClosing ? styles.invitePanelClosing : ""}`}
    >
      <button
        type="button"
        className={styles.invCancelBtn}
        onClick={dismissInviteLink}
        aria-label="Dismiss invite link"
        title="Dismiss"
      >
        <i className="ti ti-x" aria-hidden="true" />
      </button>

      <i
        className="ti ti-link"
        style={{ fontSize: 18, color: "var(--accent)", flexShrink: 0 }}
        aria-hidden="true"
      />
      <input className={styles.inviteLinkInput} readOnly value={inviteLink} />
      <div className={styles.invActions}>
        <button
          className={`${styles.invActionBtn} ${styles.invCopy}`}
          onClick={copyInviteLink}
        >
          <i
            className={`ti ${copied ? "ti-check" : "ti-copy"}`}
            style={{ fontSize: 14 }}
            aria-hidden="true"
          />
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `You've been invited to join ${companyName} on Ehra.\n\n${inviteLink}`,
          )}`}
          target="_blank"
          rel="noreferrer"
          className={`${styles.invActionBtn} ${styles.invWa}`}
        >
          <i
            className="ti ti-brand-whatsapp"
            style={{ fontSize: 14 }}
            aria-hidden="true"
          />{" "}
          Share
        </a>
      </div>
    </div>
  ) : null;

  // Today's Pulse (mobile hero widget) — real attendance figures. "Staff"
  // = active employees (the people expected to clock in); "clocked in" =
  // anyone with a record in today's attendance feed at all.
  // "Clocked in" must only count people who actually clocked in — the
  // backend now also creates an explicit ABSENT record (no clockIn
  // timestamp) once an employee's scheduled clock-out time passes without
  // them showing up, so `latestAttendance` can contain rows for people who
  // were never actually present. Filtering on `clockIn` keeps those two
  // groups from being conflated (previously `latestAttendance.length`
  // counted absentees as "clocked in" too).
  const pulseTotalStaff = safeSummary.activeEmployees;
  const pulseClockedIn = latestAttendance.filter((r) => !!r.clockIn).length;
  const pulseLate = latestAttendance.filter((r) => r.status === "LATE").length;
  const pulseOnTime = Math.max(pulseClockedIn - pulseLate, 0);
  // Only employees explicitly marked ABSENT count as absent — anyone who
  // simply hasn't clocked in yet but whose shift also hasn't ended isn't
  // "absent" yet, just not yet accounted for.
  const pulseAbsent = latestAttendance.filter(
    (r) => r.status === "ABSENT",
  ).length;
  const pulsePercent =
    pulseTotalStaff > 0
      ? Math.round((pulseClockedIn / pulseTotalStaff) * 100)
      : 0;
  const pulseLastClockInLabel = (() => {
    const timestamps = latestAttendance
      .map((r) => r.clockIn)
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    if (timestamps.length === 0) return "No clock-ins yet today";
    return `Last clock-in ${timeAgo(new Date(Math.max(...timestamps)).toISOString())}`;
  })();

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={styles.dash}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sbLogo}>
          {businessProfile?.logo ? (
            <img
              src={businessProfile.logo}
              alt={businessProfile?.name || "Business logo"}
              className={styles.sbLogoImg}
            />
          ) : (
            <div className={styles.sbLogoIcon}>💼</div>
          )}
          <span className={styles.sbLogoText}>
            {businessProfile?.name || "Ehra"}
          </span>
        </div>

        <nav className={styles.sbNav}>
          {["main", "tools", "account"].map((section) => (
            <div key={section}>
              <div className={styles.sbSection}>{section}</div>
              {NAV.filter((n) => n.section === section).map((n) => (
                <div
                  key={n.label}
                  className={`${styles.sbItem} ${activeNav === n.label && !n.isFullPage ? styles.active : ""}`}
                  onClick={() => {
                    if (n.isFullPage) {
                      navigate("/my-accounts", {
                        state: { returnPath: "/dashboard", activeNav },
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
                  {n.label === "Leave" && pendingLeaves.length > 0 && (
                    <span className={styles.sbBadge}>
                      {pendingLeaves.length}
                    </span>
                  )}
                  {n.label === "Profile Edits" &&
                    pendingProfileEdits.length > 0 && (
                      <span className={styles.sbBadge}>
                        {pendingProfileEdits.length}
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
                initials(adminFirst, adminLast)
              )}
            </div>
            <div className={styles.sbUserRow}>
              <div>
                <div className={styles.sbUserName}>
                  {loadingSummary
                    ? "Loading…"
                    : `${adminFirst} ${adminLast}`.trim()}
                </div>
                <div className={styles.sbUserRole}>Employer · Admin</div>
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
          <div>
            <h1 className={styles.topbarTitle}>
              <span className={styles.topbarTitleFull}>
                {loadingSummary ? "Loading…" : `${companyName} Dashboard`}
              </span>
              <span className={styles.topbarTitleShort}>
                {loadingSummary ? "Loading…" : companyName}
              </span>
              {/* Mobile-only: the business's own logo + name stand in for
                  the company name up here, same as the desktop title but
                  with a small logo mark alongside it. */}
              <span className={styles.topbarMobileBrand}>
                <span className={styles.topbarMobileLogo}>
                  {businessProfile?.logo ? (
                    <img
                      src={businessProfile.logo}
                      alt={companyName}
                      className={styles.topbarMobileLogoImg}
                    />
                  ) : (
                    <i className="ti ti-building" aria-hidden="true" />
                  )}
                </span>
                <span className={styles.topbarMobileLogoText}>
                  {loadingSummary ? "Loading…" : companyName}
                </span>
              </span>
            </h1>
            <p className={styles.topbarSub}>{today}</p>
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

            <button
              className={styles.inviteBtn}
              onClick={generateInviteLink}
              disabled={loadingInvite}
            >
              <i
                className="ti ti-user-plus"
                style={{ fontSize: 15 }}
                aria-hidden="true"
              />
              {loadingInvite ? "Generating…" : "Invite employee"}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div
          className={
            activeNav === "Attendance" ||
            activeNav === "Departments" ||
            activeNav === "Leave" ||
            activeNav === "Messages" ||
            activeNav === "My profile" ||
            activeNav === "QR Code" ||
            activeNav === "Notifications"
              ? styles.contentFullNarrow
              : activeNav === "Workforce" || activeNav === "Profile Edits"
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
          ) : activeNav === "Departments" ? (
            <DepartmentsTab />
          ) : activeNav === "Workforce" ? (
            <WorkforceTab departments={departments} />
          ) : activeNav === "Messages" ? (
            <MessagesTab employees={employees} />
          ) : activeNav === "Leave" ? (
            <LeavesTab />
          ) : activeNav === "Attendance" ? (
            <AttendanceSection />
          ) : activeNav === "QR Code" ? (
            <QrCodeTab />
          ) : activeNav === "Penalty" ? (
            <PenaltyTab />
          ) : activeNav === "Reports" ? (
            <ReportsTab departments={departments} />
          ) : activeNav === "Profile Edits" ? (
            <ProfileEditApprovalPanel
              mode="employer"
              pending={pendingProfileEdits}
              all={profileEdits}
              loading={loadingProfileEdits}
              onDecide={handleEmployerProfileEditDecide}
            />
          ) : activeNav === "My profile" ? (
            <BusinessSettingsTab
              business={businessProfile}
              loadingBusiness={loadingBusinessProfile}
              onSaveBusiness={handleSaveBusinessProfile}
              onLogoUploaded={handleLogoUploaded}
              myProfile={myProfile}
              loadingMyProfile={loadingMyProfile}
              onMyProfileUpdated={fetchMyProfile}
              attendanceProfile={attendanceProfile}
              loadingAttendanceProfile={loadingAttendanceProfile}
              onToggleAttendanceProfile={handleToggleAttendanceProfile}
            />
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

              <div className={styles.inviteLinkDesktopSlot}>
                {inviteLinkPanel}
              </div>

              {/* Today's Pulse — mobile-only hero widget, replaces the
                  totals row on phones (see .todaysPulseMobile). */}
              <div className={styles.todaysPulseMobile}>
                <TodaysPulse
                  totalStaff={pulseTotalStaff}
                  clockedIn={pulseClockedIn}
                  onTime={pulseOnTime}
                  late={pulseLate}
                  absent={pulseAbsent}
                  percent={pulsePercent}
                  lastClockInLabel={pulseLastClockInLabel}
                />
              </div>

              {/* Stats */}
              <div className={styles.statsGrid}>
                {[
                  {
                    icon: "ti-users",
                    color: "teal",
                    num: loadingSummary ? "—" : safeSummary.totalEmployees,
                    label: "Total employees",
                    trend: loadingSummary
                      ? "Loading…"
                      : `${safeSummary.activeEmployees} active`,
                    trendColor: "var(--accent-hover)",
                  },
                  {
                    icon: "ti-calendar-check",
                    color: "amber",
                    num: loadingSummary ? "—" : safeSummary.activeEmployees,
                    label: "Active employees",
                    trend: loadingSummary
                      ? "Loading…"
                      : `${safeSummary.totalEmployees - safeSummary.activeEmployees} not yet active`,
                    trendColor: "var(--warning-text)",
                  },
                  {
                    icon: "ti-clock",
                    color: "blue",
                    num: loadingSummary ? "—" : safeSummary.pendingApprovals,
                    label: "Pending approvals",
                    trend: loadingSummary
                      ? "Loading…"
                      : safeSummary.pendingApprovals === 0
                        ? "All caught up"
                        : "Needs your review",
                    trendColor: "var(--info-text)",
                  },
                  {
                    icon: "ti-bell",
                    color: "coral",
                    num: unreadCount,
                    label: "Unread notifications",
                    trend: unreadCount === 0 ? "All read" : "Unread alerts",
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
                          icon: "ti-report-analytics",
                          label: "Business report",
                          color: "blue",
                          action: () => setReportSummaryOpen(true),
                        },
                        {
                          icon: "ti-user-plus",
                          label: "Invite employee",
                          color: "teal",
                          action: generateInviteLink,
                        },
                        {
                          icon: "ti-building-plus",
                          label: "Add department",
                          color: "amber",
                          action: () => setAddDeptOpen(true),
                        },
                        {
                          icon: "ti-speakerphone",
                          label: "Send message",
                          color: "coral",
                          action: () => setSendMsgOpen(true),
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

                  {/* Phones only: the generated invite link shows up right
                      here, directly under the row that has the "Invite
                      employee" pill, instead of only appearing near the
                      top of the page. */}
                  <div className={styles.inviteLinkMobileSlot}>
                    {inviteLinkPanel}
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

              {/* Pending approvals table */}
              <div className={styles.dirPanel}>
                <button
                  type="button"
                  className={styles.panelHdrToggle}
                  onClick={() => setPendingApprovalsOpen((o) => !o)}
                  aria-expanded={pendingApprovalsOpen}
                >
                  <div className={styles.dirHdr}>
                    <span className={styles.panelTitle}>
                      Pending approvals
                      {pending.length > 0 && (
                        <span
                          className={styles.sbBadge}
                          style={{
                            marginLeft: 8,
                            background: "var(--warning-bg)",
                            color: "var(--warning-text)",
                          }}
                        >
                          {pending.length}
                        </span>
                      )}
                    </span>
                    <i
                      className={`ti ${pendingApprovalsOpen ? "ti-chevron-up" : "ti-chevron-down"} ${styles.panelChevron}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {pendingApprovalsOpen && (
                  <div className={styles.dirBody}>
                    {loadingPending ? (
                      <p className={styles.emptyState}>
                        Loading pending registrations…
                      </p>
                    ) : pending.length === 0 ? (
                      <p className={styles.emptyState}>
                        No pending registrations right now.
                      </p>
                    ) : (
                      <div className={styles.tableScrollWrap}>
                        <table
                          className={`${styles.empTable} ${styles.attendanceTable}`}
                        >
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th>Submitted</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pending.map((emp) => {
                              const name = [emp.firstName, emp.lastName]
                                .filter(Boolean)
                                .join(" ");
                              return (
                                <tr key={emp.id}>
                                  <td>
                                    <div className={styles.empNameCell}>
                                      <div className={styles.empAv}>
                                        {emp.profilePictureUrl ? (
                                          <img
                                            src={emp.profilePictureUrl}
                                            alt=""
                                          />
                                        ) : (
                                          initials(emp.firstName, emp.lastName)
                                        )}
                                      </div>
                                      <div className={styles.empName}>
                                        {name || "—"}
                                      </div>
                                    </div>
                                  </td>
                                  <td className={styles.muted}>{emp.email}</td>
                                  <td className={styles.muted}>
                                    {emp.phone ?? "—"}
                                  </td>
                                  <td className={styles.muted}>
                                    {emp.createdAt
                                      ? new Date(
                                          emp.createdAt,
                                        ).toLocaleDateString()
                                      : "—"}
                                  </td>
                                  <td>
                                    <div className={styles.tblActions}>
                                      <button
                                        className={styles.tblBtn}
                                        disabled={actioningId === emp.id}
                                        onClick={() => approveEmployee(emp.id)}
                                      >
                                        {actioningId === emp.id
                                          ? "…"
                                          : "Approve"}
                                      </button>
                                      <button
                                        className={`${styles.tblBtn} ${styles.danger}`}
                                        disabled={actioningId === emp.id}
                                        onClick={() => rejectEmployee(emp.id)}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pending leave requests table */}
              <div className={styles.dirPanel}>
                <button
                  type="button"
                  className={styles.panelHdrToggle}
                  onClick={() => setPendingLeavesOpen((o) => !o)}
                  aria-expanded={pendingLeavesOpen}
                >
                  <div className={styles.dirHdr}>
                    <span className={styles.panelTitle}>
                      Pending leave requests
                      {pendingLeaves.length > 0 && (
                        <span
                          className={styles.sbBadge}
                          style={{
                            marginLeft: 8,
                            background: "var(--warning-bg)",
                            color: "var(--warning-text)",
                          }}
                        >
                          {pendingLeaves.length}
                        </span>
                      )}
                    </span>
                    <i
                      className={`ti ${pendingLeavesOpen ? "ti-chevron-up" : "ti-chevron-down"} ${styles.panelChevron}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {pendingLeavesOpen && (
                  <div className={styles.dirBody}>
                    {loadingPendingLeaves ? (
                      <p className={styles.emptyState}>
                        Loading leave requests…
                      </p>
                    ) : pendingLeaves.length === 0 ? (
                      <p className={styles.emptyState}>
                        No pending leave requests right now.
                      </p>
                    ) : (
                      <div className={styles.tableScrollWrap}>
                        <table
                          className={`${styles.empTable} ${styles.attendanceTable}`}
                        >
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Dates</th>
                              <th>Reason</th>
                              <th>Requested</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingLeaves.map((lv) => {
                              const name = fullName(
                                lv.employeeFirstName,
                                lv.employeeLastName,
                              );
                              return (
                                <tr key={lv.id}>
                                  <td>
                                    <div className={styles.empNameCell}>
                                      <div className={styles.empAv}>
                                        {lv.employeeProfilePictureUrl ? (
                                          <img
                                            src={lv.employeeProfilePictureUrl}
                                            alt=""
                                          />
                                        ) : (
                                          initials(
                                            lv.employeeFirstName,
                                            lv.employeeLastName,
                                          )
                                        )}
                                      </div>
                                      <div>
                                        <div className={styles.empName}>
                                          {name || "—"}
                                        </div>
                                        <div className={styles.empEmail}>
                                          {lv.employeeEmail}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className={styles.muted}>
                                    {lv.startDate} → {lv.endDate} ({lv.days} day
                                    {lv.days > 1 ? "s" : ""})
                                  </td>
                                  <td
                                    className={styles.muted}
                                    style={{ maxWidth: 240 }}
                                  >
                                    {lv.reason}
                                  </td>
                                  <td className={styles.muted}>
                                    {lv.createdAt
                                      ? new Date(
                                          lv.createdAt,
                                        ).toLocaleDateString()
                                      : "—"}
                                  </td>
                                  <td>
                                    <div className={styles.tblActions}>
                                      <button
                                        className={styles.tblBtn}
                                        disabled={actioningLeaveId === lv.id}
                                        onClick={() =>
                                          approveLeaveRequest(lv.id)
                                        }
                                      >
                                        {actioningLeaveId === lv.id
                                          ? "…"
                                          : "Approve"}
                                      </button>
                                      <button
                                        className={`${styles.tblBtn} ${styles.danger}`}
                                        disabled={actioningLeaveId === lv.id}
                                        onClick={() =>
                                          rejectLeaveRequest(lv.id)
                                        }
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Latest attendance — today's clock-ins/outs, with quick access
              to a full profile or to remove an employee. The full directory
              now lives under the Workforce tab. */}
              <div className={styles.dirPanel}>
                <div className={styles.dirHdr}>
                  <span className={styles.panelTitle}>
                    Latest attendance
                    <span className={styles.panelSubtitle}>{today}</span>
                  </span>
                  <button
                    className={styles.panelAction}
                    onClick={fetchLatestAttendance}
                  >
                    <i
                      className="ti ti-refresh"
                      style={{ fontSize: 13 }}
                      aria-hidden="true"
                    />{" "}
                    Refresh
                  </button>
                </div>

                {loadingLatestAttendance ? (
                  <p className={styles.emptyState}>
                    Loading today's attendance…
                  </p>
                ) : latestAttendance.length === 0 ? (
                  <p className={styles.emptyState}>
                    No one has clocked in yet today.
                  </p>
                ) : (
                  <div className={styles.tableScrollWrap}>
                    <table
                      className={`${styles.empTable} ${styles.attendanceTable}`}
                    >
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Clock in</th>
                          <th>Clock out</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestAttendance.map((row) => {
                          const name = fullName(
                            row.employeeFirstName,
                            row.employeeLastName,
                          );
                          const status = row.status ?? "PRESENT";
                          return (
                            <tr key={row.id}>
                              <td>
                                <div className={styles.empNameCell}>
                                  <div className={styles.empAv}>
                                    {row.employeeProfilePictureUrl ? (
                                      <img
                                        src={row.employeeProfilePictureUrl}
                                        alt=""
                                      />
                                    ) : (
                                      initials(
                                        row.employeeFirstName,
                                        row.employeeLastName,
                                      )
                                    )}
                                  </div>
                                  <div className={styles.empName}>
                                    {name || "—"}
                                  </div>
                                </div>
                              </td>
                              <td
                                className={styles.muted}
                                data-label="Department"
                              >
                                {row.department || "Unassigned"}
                              </td>
                              <td
                                className={styles.muted}
                                data-label="Clock in"
                              >
                                {row.clockIn
                                  ? new Date(row.clockIn).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )
                                  : "—"}
                              </td>
                              <td
                                className={styles.muted}
                                data-label="Clock out"
                              >
                                {row.clockOut
                                  ? new Date(row.clockOut).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )
                                  : "—"}
                              </td>
                              <td data-label="Status">
                                <span
                                  className={`${styles.statusPill} ${styles[ATTENDANCE_PILL[status]] ?? ""}`}
                                >
                                  {ATTENDANCE_LABEL[status] ?? status}
                                </span>
                              </td>
                              <td>
                                <div className={styles.tblActions}>
                                  <button
                                    className={styles.tblBtn}
                                    onClick={() =>
                                      handleViewEmployee(row.employeeId)
                                    }
                                  >
                                    View
                                  </button>
                                  <button
                                    className={`${styles.tblBtn} ${styles.danger}`}
                                    disabled={removingId === row.employeeId}
                                    onClick={() => handleRequestRemove(row)}
                                  >
                                    <i
                                      className="ti ti-trash"
                                      style={{ fontSize: 13 }}
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <RemoveEmployeeModal
        employee={removeConfirm}
        loading={!!removingId}
        onCancel={() => setRemoveConfirm(null)}
        onConfirm={handleConfirmRemove}
      />

      <AddDepartmentModal
        open={addDeptOpen}
        onClose={() => setAddDeptOpen(false)}
        onCreated={handleDepartmentCreated}
        employees={employees}
      />

      <QuickSendMessageModal
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        employees={employees}
      />

      <BusinessReportModal
        open={reportSummaryOpen}
        onClose={() => setReportSummaryOpen(false)}
      />

      {/* ── Mobile bottom navigation ──────────────────────────────────────
          Every destination lives in one horizontally scrollable strip —
          swipe sideways to reach items past the visible edge, same as a
          native app's scrollable tab bar. Hidden entirely on desktop. */}
      <nav className={styles.bottomNav} aria-label="Primary">
        <div className={styles.bottomNavScroll} ref={bottomNavScrollRef}>
          {NAV.filter(
            (n) =>
              // Notifications and Messages stay reachable on mobile via the
              // topbar bell icon / elsewhere, but are dropped from this
              // strip specifically.
              n.label !== "Notifications" && n.label !== "Messages",
          ).map((n) => (
            <button
              key={n.label}
              type="button"
              className={`${styles.bottomNavItem} ${activeNav === n.label && !n.isFullPage ? styles.bottomNavActive : ""}`}
              onClick={() =>
                n.isFullPage
                  ? navigate("/my-accounts", {
                      state: { returnPath: "/dashboard", activeNav },
                    })
                  : setActiveNav(n.label)
              }
            >
              <div className={styles.bottomNavIconWrap}>
                <i className={`ti ${n.icon}`} aria-hidden="true" />
                {n.label === "Notifications" && unreadCount > 0 && (
                  <span className={styles.bottomNavDot} />
                )}
                {n.label === "Leave" && pendingLeaves.length > 0 && (
                  <span className={styles.bottomNavDot} />
                )}
                {n.label === "Profile Edits" &&
                  pendingProfileEdits.length > 0 && (
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
