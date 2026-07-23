import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getEmployeeProfile, sendAnnouncement } from "../api/workforceApi";
import { getUnreadCount, getMyUnreadCount } from "../api/notificationApi";
import EmploymentTab from "../components/EmploymentTab";
import PayrollTab from "../components/PayrollTab";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
// Reuses the exact sidebar/topbar/bottom-nav classes both dashboards are
// built on (they already share this one file) so the shell around a
// profile looks and behaves identically to the dashboard it was opened
// from, instead of this page inventing its own nav from scratch.
import shellStyles from "./Dashboard.module.css";
import styles from "./EmployeeProfilePage.module.css";

// ── Nav destinations ─────────────────────────────────────────────────────
// Mirrors NAV in Dashboard.jsx (employer) / EmployeeDashboard.jsx
// (employee/HOD). This page sits outside either dashboard's tab-switcher,
// so "clicking a nav item" here means a real route change rather than
// local state — see goToNav, which sends the label along as
// navigate state the same way each dashboard's own nav already does for
// the "My Accounts" full-page detour.
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

const EMPLOYEE_NAV = [
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

// Drives the bottom-nav's scroll-position indicator on mobile — copied
// from Dashboard.jsx/EmployeeDashboard.jsx (same small, self-contained
// helper, no shared-hooks module exists for it yet).
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

const STATUS_COLOR = {
  ACTIVE: { bg: "var(--bg-soft-accent)", color: "var(--accent-hover)" },
  PENDING_APPROVAL: { bg: "var(--warning-bg)", color: "var(--warning-text)" },
  REJECTED: { bg: "var(--danger-bg)", color: "var(--danger-text)" },
  SUSPENDED: { bg: "var(--bg-surface-alt)", color: "var(--text-secondary)" },
};

const ATTENDANCE_COLOR = {
  PRESENT: { bg: "var(--bg-soft-accent)", color: "var(--accent-hover)" },
  LATE: { bg: "var(--warning-bg)", color: "var(--warning-text)" },
  EARLY_LEAVE: { bg: "var(--info-bg)", color: "var(--info-text)" },
  ABSENT: { bg: "var(--danger-bg)", color: "var(--danger-text)" },
};

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // When navigated from HodWorkforceTab, state.hodView=true — hide messaging.
  const hodView = location.state?.hodView === true;

  const isAdmin = user?.role === "ROLE_ADMIN";
  const isHod = user?.membershipRole === "HOD";
  const dashboardPath = isAdmin ? "/dashboard" : "/my-dashboard";
  const visibleNav = (isAdmin ? ADMIN_NAV : EMPLOYEE_NAV).filter(
    (n) => !n.hodOnly || isHod,
  );

  // Every nav item is a real navigation now (there's no local tab state on
  // this page to flip) — landing back on the dashboard with `activeNav` set
  // is exactly what each dashboard's own nav already does for you when you
  // click around normally, so this page just plugs into that.
  const goToNav = (n) => {
    if (n.isFullPage) {
      navigate("/my-accounts", { state: { returnPath: dashboardPath } });
      return;
    }
    navigate(dashboardPath, { state: { activeNav: n.label } });
  };

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

  const bottomNavScrollRef = useRef(null);
  const bottomNavThumb = useScrollThumb(bottomNavScrollRef);
  const tabsScrollRef = useRef(null);
  const tabsThumb = useScrollThumb(tabsScrollRef);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);

  // Badge on the topbar bell — same lightweight count-only endpoint each
  // dashboard's own bell uses, so it's real and not just decorative.
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  useEffect(() => {
    (isAdmin ? getUnreadCount() : getMyUnreadCount())
      .then(({ data }) => setUnreadNotifCount(data?.count ?? data ?? 0))
      .catch((err) =>
        console.error("Failed to load unread notification count:", err),
      );
  }, [isAdmin]);

  useEffect(() => {
    getEmployeeProfile(id)
      .then(({ data }) => setProfile(data))
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendMessage = async () => {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setSending(true);
    try {
      await sendAnnouncement({
        subject: msgSubject,
        body: msgBody,
        recipientEmployeeId: Number(id),
      });
      setMsgOpen(false);
      setMsgSubject("");
      setMsgBody("");
      alert("Message sent successfully.");
    } catch {
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading employee profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.loadingWrap}>
        <p>Employee not found.</p>
        <button onClick={() => navigate(dashboardPath)}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const statusStyle = STATUS_COLOR[profile.status] || STATUS_COLOR.ACTIVE;

  return (
    <div className={shellStyles.dash}>
      {/* ── Sidebar (desktop/tablet) ── */}
      <aside className={shellStyles.sidebar}>
        <div className={shellStyles.sbLogo}>
          <div className={shellStyles.sbLogoIcon}>💼</div>
          <span className={shellStyles.sbLogoText}>Ehra</span>
        </div>

        <nav className={shellStyles.sbNav}>
          {["main", "tools", "account"].map((section) => (
            <div key={section}>
              <div className={shellStyles.sbSection}>{section}</div>
              {visibleNav
                .filter((n) => n.section === section)
                .map((n) => (
                  <div
                    key={n.label}
                    className={shellStyles.sbItem}
                    onClick={() => goToNav(n)}
                  >
                    <i className={`ti ${n.icon}`} aria-hidden="true" />
                    {n.label}
                  </div>
                ))}
            </div>
          ))}
        </nav>

        <div className={shellStyles.sbFooter}>
          <button
            type="button"
            className={styles.sidebarLogoutBtn}
            onClick={() => setShowLogoutConfirm(true)}
          >
            <i className="ti ti-logout" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={shellStyles.main}>
        <div className={shellStyles.topbar}>
          <span className={shellStyles.topbarTitle}>Employee profile</span>
          <div className={shellStyles.topbarRight}>
            {/* ── Message shortcut — same jump-to-Messages affordance the
                dashboards' topbar has, just via a route instead of local
                tab state since this page lives outside either dashboard. ── */}
            <div
              className={shellStyles.notifBtn}
              onClick={() => goToNav({ label: "Messages" })}
              aria-label="Messages"
              title="Messages"
            >
              <i
                className="ti ti-message-circle"
                style={{ fontSize: 17 }}
                aria-hidden="true"
              />
            </div>

            {/* ── Notification bell — real unread count, jumps to the
                Notifications tab on the dashboard this profile belongs to. ── */}
            <div
              className={shellStyles.notifBtn}
              onClick={() => goToNav({ label: "Notifications" })}
              aria-label="Notifications"
              title="Notifications"
            >
              <i
                className="ti ti-bell"
                style={{ fontSize: 17 }}
                aria-hidden="true"
              />
              {unreadNotifCount > 0 && (
                <span className={shellStyles.notifCount}>
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </div>

            <ThemeToggleMenu />
          </div>
        </div>

        <div
          className={shellStyles.contentFull}
          style={{ overflowX: "hidden", minWidth: 0 }}
        >
          {/* ── Hero section ── */}
          <div className={styles.hero}>
            <div className={styles.heroLeft}>
              <div className={styles.avatar}>
                {profile.profilePictureUrl ? (
                  <img
                    src={profile.profilePictureUrl}
                    alt={name}
                    className={styles.avatarImg}
                  />
                ) : (
                  <span className={styles.avatarInitials}>
                    {initials(profile.firstName, profile.lastName)}
                  </span>
                )}
              </div>
              <div className={styles.heroInfo}>
                <div className={styles.heroNameRow}>
                  <h1 className={styles.heroName}>{name}</h1>
                  <span
                    className={styles.statusBadge}
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                    }}
                  >
                    {profile.status?.replace("_", " ")}
                  </span>
                </div>
                <p className={styles.heroEmail}>{profile.email}</p>
                {profile.phone && (
                  <p className={styles.heroPhone}>{profile.phone}</p>
                )}
                <div className={styles.heroBadges}>
                  <span className={styles.roleBadge}>{profile.role}</span>
                  <span className={styles.deptBadge}>
                    <i
                      className="ti ti-building"
                      style={{ fontSize: 11 }}
                      aria-hidden="true"
                    />
                    {profile.departmentName || "Unassigned"}
                  </span>
                  {profile.hodName && (
                    <span className={styles.hodBadge}>
                      <i
                        className="ti ti-user-star"
                        style={{ fontSize: 11 }}
                        aria-hidden="true"
                      />
                      HOD: {profile.hodName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.heroActions}>
              {!hodView && (
                <button
                  className={styles.msgBtn}
                  onClick={() => setMsgOpen(true)}
                >
                  <span className={styles.msgBtnIcon}>
                    <i className="ti ti-send" aria-hidden="true" />
                  </span>
                  Send message
                </button>
              )}
              {profile.idCardUrl && (
                <a
                  href={profile.idCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.idCardBtn}
                >
                  <i className="ti ti-id-badge" aria-hidden="true" /> View ID
                  card
                </a>
              )}
            </div>
          </div>

          {/* ── Tabs ──
              Inline styles here are deliberate, not decorative — they're a
              guaranteed fallback for the exact scroll-collapse bug this row
              already had once (a flex child's default min-width: auto
              refusing to shrink below six un-wrapped buttons' width, so on
              phones the row rendered full-width and everything past the
              first tab or two got silently clipped by the parent's
              overflow-x: hidden, with nothing left visible to even tap).
              The matching CSS module rule handles this too, but inline
              styles ship in the same JS bundle as the button labels
              themselves, so they can't end up out of sync with a
              separately-hashed CSS chunk the way an external stylesheet
              rule could. Belt and suspenders. */}
          <div
            className={styles.tabs}
            ref={tabsScrollRef}
            style={{
              display: "flex",
              overflowX: "auto",
              minWidth: 0,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {[
              { key: "overview", label: "Overview" },
              { key: "attendance", label: "Attendance" },
              { key: "leave", label: "Leave" },
              { key: "employment", label: "Employment" },
              { key: "payroll", label: "Payroll" },
              ...(!hodView
                ? [{ key: "announcements", label: "Messages" }]
                : []),
            ].map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                onClick={() => setTab(t.key)}
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* On phones, six tabs don't all fit — this row scrolls, but a
              plain overflow-x: auto row gives no visual hint that there's
              more to swipe to, so Attendance/Leave/Employment/Payroll/
              Messages could sit just out of view with nothing suggesting
              they exist. Same scroll-position indicator already used for
              the bottom nav below, just applied to this row. */}
          <div className={styles.tabsScrollTrack} aria-hidden="true">
            <div
              className={styles.tabsScrollThumb}
              style={{
                width: `${tabsThumb.width}%`,
                left: `${tabsThumb.left}%`,
              }}
            />
          </div>

          {/* ── Tab content ── */}
          <div className={styles.tabContent} style={{ minWidth: 0 }}>
            {/* Overview */}
            {tab === "overview" && (
              <div className={styles.overviewGrid}>
                <div className={styles.infoCard}>
                  <h3 className={styles.cardTitle}>Personal details</h3>
                  <div className={styles.infoRows}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Full name</span>
                      <span className={styles.infoValue}>{name || "—"}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Email</span>
                      <span className={styles.infoValue}>{profile.email}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Phone</span>
                      <span className={styles.infoValue}>
                        {profile.phone || "—"}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Role</span>
                      <span className={styles.infoValue}>{profile.role}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>
                        {profile.status?.replace("_", " ")}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Joined</span>
                      <span className={styles.infoValue}>
                        {profile.createdAt
                          ? new Date(profile.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.infoCard}>
                  <h3 className={styles.cardTitle}>Department & HOD</h3>
                  <div className={styles.infoRows}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Department</span>
                      <span className={styles.infoValue}>
                        {profile.departmentName || "Unassigned"}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Head of dept</span>
                      <span className={styles.infoValue}>
                        {profile.hodName || "Not assigned"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.infoCard}>
                  <h3 className={styles.cardTitle}>Identity documents</h3>
                  {profile.idCardUrl ? (
                    <div className={styles.idCardPreview}>
                      <a
                        href={profile.idCardUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className={styles.idCardThumb}>
                          <i
                            className="ti ti-id-badge"
                            style={{ fontSize: 32, color: "var(--accent)" }}
                            aria-hidden="true"
                          />
                          <span>View ID card</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <p className={styles.noDoc}>No ID card uploaded yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Attendance */}
            {tab === "attendance" && (
              <div className={styles.tableWrap}>
                {!profile.recentAttendance?.length ? (
                  <p className={styles.emptyMsg}>No attendance records yet.</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Clock in</th>
                        <th>Clock out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.recentAttendance.map((a) => {
                        const st =
                          ATTENDANCE_COLOR[a.status] ||
                          ATTENDANCE_COLOR.PRESENT;
                        return (
                          <tr key={a.id}>
                            <td>{a.date}</td>
                            <td>{formatTime(a.clockIn)}</td>
                            <td>{formatTime(a.clockOut)}</td>
                            <td>
                              <span
                                className={styles.attPill}
                                style={{ background: st.bg, color: st.color }}
                              >
                                {a.status?.replace("_", " ")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Leave History */}
            {tab === "leave" && (
              <div className={styles.tableWrap}>
                {!profile.leaveHistory?.length ? (
                  <p className={styles.emptyMsg}>
                    No leave requests found for this employee.
                  </p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Applied</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Admin note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.leaveHistory.map((l) => {
                        const LEAVE_COLOR = {
                          PENDING: {
                            bg: "var(--warning-bg)",
                            color: "var(--warning-text)",
                          },
                          APPROVED: {
                            bg: "var(--bg-soft-accent)",
                            color: "var(--accent-hover)",
                          },
                          REJECTED: {
                            bg: "var(--danger-bg)",
                            color: "var(--danger-text)",
                          },
                        };
                        const st = LEAVE_COLOR[l.status] || LEAVE_COLOR.PENDING;
                        return (
                          <tr key={l.id}>
                            <td>
                              {l.createdAt
                                ? new Date(l.createdAt).toLocaleDateString()
                                : "—"}
                            </td>
                            <td>{l.startDate}</td>
                            <td>{l.endDate}</td>
                            <td>{l.days}</td>
                            <td
                              style={{
                                maxWidth: 180,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={l.reason}
                            >
                              {l.reason}
                            </td>
                            <td>
                              <span
                                className={styles.attPill}
                                style={{ background: st.bg, color: st.color }}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td
                              style={{
                                color: "var(--text-secondary)",
                                fontSize: 12,
                              }}
                            >
                              {l.adminNote || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Employment type + part-time attendance schedule */}
            {tab === "employment" && <EmploymentTab employeeId={id} />}

            {tab === "payroll" && (
              <PayrollTab employeeId={id} canManage={!hodView} />
            )}

            {/* Announcements/Messages — hidden in HOD view */}
            {tab === "announcements" && (
              <div className={styles.announcementList}>
                {!profile.recentAnnouncements?.length ? (
                  <p className={styles.emptyMsg}>
                    No messages sent to this employee yet.
                  </p>
                ) : (
                  profile.recentAnnouncements.map((a) => (
                    <div key={a.id} className={styles.announcementItem}>
                      <div className={styles.announcementTop}>
                        <span className={styles.announcementSubject}>
                          {a.subject}
                        </span>
                        <div className={styles.announcementMeta}>
                          {a.broadcast && (
                            <span className={styles.broadcastTag}>
                              Broadcast
                            </span>
                          )}
                          <span
                            className={`${styles.readTag} ${a.readByMe ? styles.readTagRead : ""}`}
                          >
                            {a.readByMe ? "Read" : "Unread"}
                          </span>
                          <span className={styles.announcementTime}>
                            {a.createdAt
                              ? new Date(a.createdAt).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                      </div>
                      <p className={styles.announcementBody}>{a.body}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className={shellStyles.bottomNav} aria-label="Primary">
        <div className={shellStyles.bottomNavScroll} ref={bottomNavScrollRef}>
          {visibleNav.map((n) => (
            <button
              key={n.label}
              type="button"
              className={shellStyles.bottomNavItem}
              onClick={() => goToNav(n)}
            >
              <div className={shellStyles.bottomNavIconWrap}>
                <i className={`ti ${n.icon}`} aria-hidden="true" />
              </div>
              <span>{n.label}</span>
            </button>
          ))}

          <button
            type="button"
            className={shellStyles.bottomNavItem}
            onClick={() => setShowLogoutConfirm(true)}
          >
            <div className={shellStyles.bottomNavIconWrap}>
              <i className="ti ti-logout" aria-hidden="true" />
            </div>
            <span>Log out</span>
          </button>
        </div>
        <div className={shellStyles.bottomNavScrollTrack} aria-hidden="true">
          <div
            className={shellStyles.bottomNavScrollThumb}
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

      {/* ── Send message modal (employer only — hidden in HOD view) ── */}
      {msgOpen && !hodView && (
        <div className={styles.modalOverlay} onClick={() => setMsgOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Send message to {profile.firstName}</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setMsgOpen(false)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Subject</label>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="e.g. Policy update"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Message</label>
                <textarea
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Write your message here…"
                  rows={5}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.cancelBtn}
                onClick={() => setMsgOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.sendBtn}
                onClick={handleSendMessage}
                disabled={sending || !msgSubject.trim() || !msgBody.trim()}
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
