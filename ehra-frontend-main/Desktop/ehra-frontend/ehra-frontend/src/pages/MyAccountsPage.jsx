import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/authApi";
import { getMyProfile } from "../api/employeeApi";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import dash from "./Dashboard.module.css";
import styles from "./MyAccountsPage.module.css";

// This page reuses the exact same shell (sidebar, topbar, mobile bottom
// nav) as Dashboard.jsx / EmployeeDashboard.jsx via Dashboard.module.css —
// see ScanAttendance.jsx for the same pattern — so a person landing here
// gets the same chrome and can navigate anywhere else in the app without
// getting stranded on a bare, nav-less page. Only the accounts list/tabs
// (styles from MyAccountsPage.module.css) are specific to this screen.

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

// This screen doesn't have its own tab system tied to the shared NAV — so
// "My Accounts" is always shown as the active nav item, same idea as
// ScanAttendance.jsx always highlighting "Attendance".
const ACTIVE_LABEL = "My Accounts";

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

// Sidebar/topbar avatar initials for the signed-in person (first + last
// name). Kept separate from the account-card `initials()` helper below,
// which abbreviates a *business* name instead.
function personInitials(first, last) {
  const f = safeString(first).trim();
  const l = safeString(last).trim();
  const firstInitial = f.length > 0 ? f.charAt(0) : "";
  const lastInitial = l.length > 0 ? l.charAt(0) : "";
  const result = `${firstInitial}${lastInitial}`.toUpperCase();
  return result || "?";
}

// Tracks a horizontally-scrollable element and returns { left, width } as
// percentages of its own track — same helper used on the dashboards and
// ScanAttendance.jsx, kept local here since it isn't exported from
// anywhere shared.
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

function initials(name) {
  return (
    (name || "")
      .split(" ")
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

const BLANK_BUSINESS = { name: "", email: "", phone: "", address: "" };

const TABS = [
  {
    key: "EMPLOYER",
    label: "Employer",
    icon: "ti-building-skyscraper",
    blurb: "Businesses you own or administer.",
  },
  {
    key: "EMPLOYEE",
    label: "Employee",
    icon: "ti-id-badge-2",
    blurb: "Businesses you work for as a member of staff.",
  },
];

// The "My Accounts" nav destination — every workspace (business) the
// logged-in Identity currently holds a membership at, either as owner
// (EMPLOYER) or as staff (EMPLOYEE). Split into two sections/tabs so each
// role's accounts are easy to scan on their own. Lets the person switch
// between them without logging out, and start a brand-new business under
// the same Identity from the Employer section (an employee going into
// business for themselves, or an owner adding a second business).
// Reachable as a full page (not a popover) from both Dashboard and
// EmployeeDashboard via the "My Accounts" nav item.
export default function MyAccountsPage() {
  const { user, logout, switchContext, addBusiness } = useAuth();
  const navigate = useNavigate();
  const bottomNavScrollRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = user?.role === "ROLE_ADMIN";
  const dashboardPath = isAdmin ? "/dashboard" : "/my-dashboard";
  const NAV = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  const bottomNavThumb = useScrollThumb(bottomNavScrollRef);

  // Best-effort profile fetch, purely to dress the shared shell (business
  // logo/name, avatar, HOD-gated nav items) the same way the dashboards
  // do. Never blocks the accounts list if it fails or is slow.
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleNavClick = (n) => {
    if (n.isFullPage) {
      // Already here — nothing to navigate to.
      return;
    }
    navigate(dashboardPath, { state: { activeNav: n.label } });
  };

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState(null);

  const [activeTab, setActiveTab] = useState(
    user?.contextType === "EMPLOYEE" ? "EMPLOYEE" : "EMPLOYER",
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_BUSINESS);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    getMyAccounts()
      .then(setAccounts)
      .catch(() => setError("Couldn't load your accounts. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const byType = { EMPLOYER: [], EMPLOYEE: [] };
    accounts.forEach((acc) => {
      if (byType[acc.type]) byType[acc.type].push(acc);
    });
    return byType;
  }, [accounts]);

  const pick = async (acc) => {
    if (acc.active) return;
    setSwitchingId(acc.membershipId);
    setError("");
    try {
      const data = await switchContext(acc.type, acc.membershipId);
      navigate(
        data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard",
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Couldn't switch to that workspace.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!form.name.trim()) {
      setCreateError("Business name is required.");
      return;
    }
    if (!form.email.trim()) {
      setCreateError("Business email is required.");
      return;
    }
    setCreating(true);
    try {
      const data = await addBusiness({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setForm(BLANK_BUSINESS);
      setShowCreate(false);
      navigate(
        data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard",
      );
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.errors
        ? Object.values(data.errors)[0]
        : data?.message || data;
      setCreateError(
        typeof msg === "string" ? msg : "Failed to create business.",
      );
    } finally {
      setCreating(false);
    }
  };

  const list = grouped[activeTab] || [];
  const activeTabMeta = TABS.find((t) => t.key === activeTab);

  const firstName = profile?.firstName || "";
  const lastName = profile?.lastName || "";
  const displayName = `${firstName} ${lastName}`.trim();

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
                personInitials(firstName, lastName)
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
              <span className={dash.topbarTitleFull}>My Accounts</span>
              <span className={dash.topbarTitleShort}>Accounts</span>
            </h1>
            <p className={dash.topbarSub}>
              Switch between every business you own or work for.
            </p>
          </div>

          <div className={dash.topbarRight}>
            <ThemeToggleMenu />
          </div>
        </div>

        <div className={dash.content}>
          <div className={styles.pageInner}>
            {error && (
              <div className={styles.errorBox} role="alert">
                <i className="ti ti-alert-circle" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Section tabs: Employer / Employee ── */}
            <div className={styles.tabs} role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.key}
                  className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
                  onClick={() => {
                    setActiveTab(t.key);
                    setShowCreate(false);
                    setCreateError("");
                  }}
                >
                  <i className={`ti ${t.icon}`} aria-hidden="true" />
                  {t.label}
                  {grouped[t.key]?.length > 0 && (
                    <span className={styles.tabCount}>
                      {grouped[t.key].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className={styles.sectionCard}>
              {!showCreate && (
                <>
                  <p className={styles.hint}>{activeTabMeta?.blurb}</p>

                  {loading ? (
                    <div className={styles.loading}>
                      <span className={styles.spinner} />
                      <span>Loading…</span>
                    </div>
                  ) : (
                    <div className={styles.grid}>
                      {list.map((acc) => (
                        <button
                          key={`${acc.type}-${acc.membershipId}`}
                          type="button"
                          className={`${styles.item} ${acc.active ? styles.itemActive : ""}`}
                          disabled={switchingId !== null}
                          onClick={() => pick(acc)}
                        >
                          <div className={styles.avatar}>
                            {acc.businessLogo ? (
                              <img src={acc.businessLogo} alt="" />
                            ) : (
                              initials(acc.businessName)
                            )}
                          </div>
                          <div className={styles.itemBody}>
                            <span className={styles.itemName}>
                              {acc.businessName}
                            </span>
                            <span className={styles.itemMeta}>
                              {acc.type === "EMPLOYER"
                                ? "Owner · Admin"
                                : "Employee"}
                              {acc.status && acc.status !== "ACTIVE"
                                ? ` · ${acc.status.replace("_", " ").toLowerCase()}`
                                : ""}
                            </span>
                          </div>
                          {acc.active ? (
                            <span className={styles.activeBadge}>Current</span>
                          ) : switchingId === acc.membershipId ? (
                            <span className={styles.spinner} />
                          ) : (
                            <i
                              className={`ti ti-chevron-right ${styles.itemChevron}`}
                            />
                          )}
                        </button>
                      ))}

                      {list.length === 0 && (
                        <p className={styles.empty}>
                          {activeTab === "EMPLOYER"
                            ? "You don't own or administer any businesses yet."
                            : "You aren't listed as an employee on any business yet."}
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === "EMPLOYER" && (
                    <button
                      type="button"
                      className={styles.createTrigger}
                      onClick={() => setShowCreate(true)}
                    >
                      <i className="ti ti-plus" />
                      Create a business under this account
                    </button>
                  )}
                </>
              )}

              {showCreate && (
                <>
                  <button
                    type="button"
                    className={styles.backLink}
                    onClick={() => {
                      setShowCreate(false);
                      setCreateError("");
                    }}
                  >
                    <i className="ti ti-arrow-left" /> Back to accounts
                  </button>

                  <p className={styles.hint}>
                    This creates a new, separate business — you'll be its owner,
                    and it stays fully independent from any other business
                    you're connected to.
                  </p>

                  {createError && (
                    <div className={styles.errorBox} role="alert">
                      <i className="ti ti-alert-circle" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label>Business name</label>
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Business email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="hello@acme.com"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Phone{" "}
                        <span className={styles.optional}>(optional)</span>
                      </label>
                      <input
                        value={form.phone}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="+234 800 000 0000"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>
                        Address{" "}
                        <span className={styles.optional}>(optional)</span>
                      </label>
                      <input
                        value={form.address}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, address: e.target.value }))
                        }
                        placeholder="123 Main St, Lagos"
                      />
                    </div>
                  </div>

                  <div className={styles.footer}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => setShowCreate(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.createBtn}
                      onClick={handleCreate}
                      disabled={creating}
                    >
                      {creating ? "Creating…" : "Create business"}
                    </button>
                  </div>
                </>
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
