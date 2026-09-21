import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/authApi";
import { getMyProfile } from "../api/employeeApi";
import { getCustomerOverview } from "../api/commerceApi";
import { getMySubscription } from "../api/subscriptionApi";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import CustomerShell from "../components/CustomerShell";
import MobileNavHub from "../components/MobileNavHub";
import useCustomerInboxBadge from "../hooks/useCustomerInboxBadge";
import useStaffNavBadges from "../hooks/useStaffNavBadges";
import dash from "./Dashboard.module.css";
import styles from "./MyAccountsPage.module.css";

// This page wears the SAME chrome as the dashboard the person came from, so
// they can navigate anywhere else without being stranded on a bare page:
//   - employers / employees: the Dashboard.jsx / EmployeeDashboard.jsx shell
//     (sidebar, top bar, scrollable bottom strip) via Dashboard.module.css -
//     see ScanAttendance.jsx for the same pattern;
//   - customers: the customer shell (components/CustomerShell.jsx) - the very
//     same sidebar, top bar and five-item bottom navigation (MobileNavHub) as
//     the customer dashboard, not the employer strip.
// Only the workspace switcher itself (MyAccountsPage.module.css) is specific
// to this screen.

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

// This screen doesn't have its own tab system tied to the shared NAV - so
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

// Deterministic colour for a workspace's monogram, so each business keeps
// the same accent every time it's shown (6 brand-adjacent tints).
function tintIndex(name) {
  let h = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i += 1)
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 6;
}

const BLANK_BUSINESS = { name: "", email: "", phone: "", address: "" };

// Membership-type → display label / post-switch destination. Same map
// used in MyAccountsPanel.jsx and SelectWorkspace.jsx, which render the
// same underlying list elsewhere - kept in sync across all three.
const ROLE_LABEL = {
  EMPLOYER: "Owner · Admin",
  EMPLOYEE: "Employee",
  CUSTOMER: "Customer",
};
function roleLabel(type) {
  return ROLE_LABEL[type] || type;
}
function destinationFor(contextType) {
  if (contextType === "EMPLOYEE") return "/my-dashboard";
  if (contextType === "CUSTOMER") return "/customer-dashboard";
  return "/dashboard";
}

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
  {
    key: "CUSTOMER",
    label: "Customer",
    icon: "ti-shopping-bag",
    blurb: "Businesses you're a customer of.",
  },
];

// The "My Accounts" nav destination - every workspace (business) the
// logged-in Identity currently holds a membership at: as owner (EMPLOYER),
// as staff (EMPLOYEE), or as a customer (CUSTOMER). Customer is always
// available as an identity-wide context, even before the first connection.
// Split into sections/tabs so each role's accounts are easy to scan on
// their own. Lets the person switch between them without logging out, and
// start a brand-new business under the same Identity from the Employer
// section (an employee going into business for themselves, or an owner
// adding a second business). Reachable as a full page (not a popover) from
// both Dashboard and EmployeeDashboard via the "My Accounts" nav item.
export default function MyAccountsPage() {
  const { user, logout, switchContext, addBusiness } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = user?.role === "ROLE_ADMIN";
  const isCustomer = user?.role === "ROLE_CUSTOMER";
  const dashboardPath = isCustomer
    ? "/customer-dashboard"
    : isAdmin
      ? "/dashboard"
      : "/my-dashboard";
  const NAV = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  // Customers get the same Messages badge as on their dashboard.
  const inbox = useCustomerInboxBadge({
    enabled: isCustomer,
    includeAnnouncements: true,
  });
  // Employer / employee phone-nav badges (Messages, Notifications, ...), same numbers as their dashboard.
  const staffBadges = useStaffNavBadges(
    isCustomer ? null : isAdmin ? "employer" : "employee",
  );
  const [query, setQuery] = useState("");

  // Best-effort profile fetch, purely to dress the shared shell (business
  // logo/name, avatar, HOD-gated nav items) the same way the dashboards
  // do. Never blocks the accounts list if it fails or is slow.
  useEffect(() => {
    let cancelled = false;
    if (isCustomer) {
      getCustomerOverview()
        .then(({ data }) => {
          if (!cancelled) setCustomerProfile(data);
        })
        .catch(() => {});
    } else {
      getMyProfile()
        .then(({ data }) => {
          if (!cancelled) setProfile(data);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [isCustomer]);

  useEffect(() => {
    if (isCustomer) return undefined;
    let cancelled = false;
    getMySubscription()
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCustomer]);

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
      // Already here - nothing to navigate to.
      return;
    }
    navigate(dashboardPath, { state: { activeNav: n.label } });
  };

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState(null);

  const [activeTab, setActiveTab] = useState(
    user?.contextType === "CUSTOMER"
      ? "CUSTOMER"
      : user?.contextType === "EMPLOYEE"
        ? "EMPLOYEE"
        : "EMPLOYER",
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_BUSINESS);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let dead = false;
    getMyAccounts()
      .then((list) => {
        if (!dead) setAccounts(list);
      })
      .catch(() => {
        if (!dead) setError("Couldn't load your accounts. Please try again.");
      })
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byType = { EMPLOYER: [], EMPLOYEE: [], CUSTOMER: [] };
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
      navigate(destinationFor(data.contextType));
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
      navigate(destinationFor(data.contextType));
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

  const activeTabMeta = TABS.find((t) => t.key === activeTab);
  const activeTabIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === activeTab),
  );
  const maxBusinesses = Number(subscription?.maxBusinesses || 0);
  const employerBusinessCount = grouped.EMPLOYER.length;
  const canCreateBusiness =
    maxBusinesses > 0 ? employerBusinessCount < maxBusinesses : true;

  // Current tab's accounts: the one you're in first, then alphabetical; the
  // filter box only appears once the list is long enough to need it.
  const q = query.trim().toLowerCase();
  const allInTab = [...(grouped[activeTab] || [])].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      safeString(a.businessName).localeCompare(safeString(b.businessName)),
  );
  const list = q
    ? allInTab.filter((a) =>
        safeString(a.businessName).toLowerCase().includes(q),
      )
    : allInTab;
  const showSearch = allInTab.length > 4;

  const current = accounts.find((a) => a.active) || null;
  const rolesInUse = TABS.filter((t) => grouped[t.key]?.length > 0).length;

  const firstName =
    (isCustomer ? customerProfile?.firstName : profile?.firstName) || "";
  const lastName =
    (isCustomer ? customerProfile?.lastName : profile?.lastName) || "";
  const displayName = `${firstName} ${lastName}`.trim();
  const profileImage = isCustomer
    ? customerProfile?.profileImage
    : profile?.profilePictureUrl;

  const selectTab = (key) => {
    setActiveTab(key);
    setShowCreate(false);
    setCreateError("");
    setQuery("");
  };

  const onTabKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      (activeTabIndex + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) %
      TABS.length;
    selectTab(TABS[next].key);
  };

  const discoverBusinesses = async () => {
    setError("");
    try {
      const data = await switchContext("CUSTOMER", null);
      navigate(destinationFor(data.contextType) + "?tab=discover");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Couldn't open the Customer experience.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    }
  };

  const customerNavigate = (id) =>
    navigate(`/customer-dashboard?tab=${encodeURIComponent(id)}`);

  // ── The switcher itself - identical inside either chrome ───────────────
  const content = (
    <div className={styles.page}>
      <div className={styles.aura} aria-hidden="true" />

      {/* Identity - straight on the page background */}
      <header className={styles.identity}>
        <div className={styles.idAvatarWrap}>
          <span className={styles.idRing} aria-hidden="true" />
          <div className={styles.idAvatar}>
            {profileImage ? (
              <img src={profileImage} alt="" />
            ) : (
              personInitials(firstName, lastName)
            )}
          </div>
        </div>
        <div className={styles.idText}>
          <span className={styles.eyebrow}>ONE IDENTITY · MANY WORKSPACES</span>
          <h2>{displayName || "Your Ehral identity"}</h2>
          <p>
            {loading
              ? "Loading your workspaces…"
              : accounts.length === 0
                ? "No workspaces yet."
                : `${accounts.length} workspace${accounts.length === 1 ? "" : "s"} across ${rolesInUse} role${rolesInUse === 1 ? "" : "s"}.`}
          </p>
        </div>
        {current && (
          <div className={styles.idNow} title="Where you are right now">
            <span className={styles.liveDot} aria-hidden="true" />
            <span>
              <small>You're in</small>
              <strong>{current.businessName}</strong>
              <em>{roleLabel(current.type)}</em>
            </span>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.errorBox} role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Role switcher - a segmented control with a sliding thumb */}
      <div
        className={styles.seg}
        role="tablist"
        aria-label="Account type"
        style={{ "--i": activeTabIndex }}
        onKeyDown={onTabKeyDown}
      >
        <span className={styles.segThumb} aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            tabIndex={activeTab === t.key ? 0 : -1}
            className={`${styles.segBtn} ${activeTab === t.key ? styles.segBtnOn : ""}`}
            onClick={() => selectTab(t.key)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            <span>{t.label}</span>
            {grouped[t.key]?.length > 0 && <b>{grouped[t.key].length}</b>}
          </button>
        ))}
      </div>

      {!showCreate && (
        <section className={styles.stage} aria-live="polite">
          <div className={styles.stageHead}>
            <p>{activeTabMeta?.blurb}</p>
            {showSearch && (
              <label className={styles.filter}>
                <i className="ti ti-search" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a workspace"
                  aria-label="Find a workspace"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                )}
              </label>
            )}
          </div>

          {loading ? (
            <div className={styles.grid} aria-busy="true">
              {[0, 1, 2].map((n) => (
                <div key={n} className={styles.skeleton} style={{ "--d": n }}>
                  <span className={styles.skLogo} />
                  <span className={styles.skLines}>
                    <span />
                    <span />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.grid}>
              {list.map((acc, i) => (
                <button
                  key={`${acc.type}-${acc.membershipId}`}
                  type="button"
                  className={`${styles.card} ${acc.active ? styles.cardActive : ""} ${switchingId === acc.membershipId ? styles.cardBusy : ""}`}
                  style={{ "--d": Math.min(i, 8) }}
                  disabled={switchingId !== null}
                  onClick={() => pick(acc)}
                  aria-current={acc.active ? "true" : undefined}
                >
                  <span
                    className={`${styles.logo} ${styles[`tint${tintIndex(acc.businessName)}`]}`}
                  >
                    {acc.businessLogo ? (
                      <img src={acc.businessLogo} alt="" />
                    ) : (
                      initials(acc.businessName)
                    )}
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.chips}>
                      <em
                        className={`${styles.chip} ${styles[`role${acc.type}`]}`}
                      >
                        {roleLabel(acc.type)}
                      </em>
                      {acc.status && acc.status !== "ACTIVE" && (
                        <em className={`${styles.chip} ${styles.chipWarn}`}>
                          {acc.status.replace("_", " ").toLowerCase()}
                        </em>
                      )}
                    </span>
                    <strong className={styles.cardName}>
                      {acc.businessName}
                    </strong>
                  </span>
                  <span className={styles.cardAction}>
                    {acc.active ? (
                      <span className={styles.here}>
                        <span className={styles.liveDot} aria-hidden="true" />{" "}
                        Current
                      </span>
                    ) : switchingId === acc.membershipId ? (
                      <span className={styles.spinner} aria-label="Switching" />
                    ) : (
                      <span className={styles.go}>
                        Switch{" "}
                        <i className="ti ti-arrow-right" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </button>
              ))}

              {/* Add / discover tiles, per role */}
              {!q && activeTab === "CUSTOMER" && (
                <button
                  type="button"
                  className={styles.tile}
                  onClick={discoverBusinesses}
                  style={{ "--d": Math.min(list.length, 8) }}
                >
                  <span className={styles.tileIcon}>
                    <i className="ti ti-compass" aria-hidden="true" />
                  </span>
                  <span className={styles.tileText}>
                    <strong>Discover businesses on Ehral</strong>
                    <small>Find shops and services, connect, and order.</small>
                  </span>
                  <i
                    className={`ti ti-arrow-up-right ${styles.tileGo}`}
                    aria-hidden="true"
                  />
                </button>
              )}

              {!q &&
                activeTab === "EMPLOYER" &&
                (canCreateBusiness ? (
                  <button
                    type="button"
                    className={styles.tile}
                    onClick={() => setShowCreate(true)}
                    style={{ "--d": Math.min(list.length, 8) }}
                  >
                    <span className={styles.tileIcon}>
                      <i className="ti ti-plus" aria-hidden="true" />
                    </span>
                    <span className={styles.tileText}>
                      <strong>Create a business</strong>
                      <small>
                        A separate business under this same account.
                      </small>
                    </span>
                    <i
                      className={`ti ti-arrow-up-right ${styles.tileGo}`}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <div
                    className={`${styles.tile} ${styles.tileLocked}`}
                    style={{ "--d": Math.min(list.length, 8) }}
                  >
                    <span className={styles.tileIcon}>
                      <i className="ti ti-lock" aria-hidden="true" />
                    </span>
                    <span className={styles.tileText}>
                      <strong>Business limit reached</strong>
                      <small>
                        Your plan allows {maxBusinesses}{" "}
                        {maxBusinesses === 1 ? "business" : "businesses"}.
                        Upgrade to add another.
                      </small>
                    </span>
                    <button
                      type="button"
                      className={styles.tileBtn}
                      onClick={() => navigate("/pricing")}
                    >
                      View plans
                    </button>
                  </div>
                ))}

              {!q && activeTab === "EMPLOYEE" && list.length === 0 && (
                <div className={`${styles.tile} ${styles.tileStatic}`}>
                  <span className={styles.tileIcon}>
                    <i className="ti ti-users" aria-hidden="true" />
                  </span>
                  <span className={styles.tileText}>
                    <strong>Waiting for an invitation</strong>
                    <small>
                      When an employer adds you to their team, that workplace
                      appears here.
                    </small>
                  </span>
                </div>
              )}
            </div>
          )}

          {!loading && list.length === 0 && (
            <p className={styles.empty}>
              {q
                ? `No workspace matches "${query.trim()}".`
                : activeTab === "EMPLOYER"
                  ? "You don't own or administer any businesses yet."
                  : activeTab === "CUSTOMER"
                    ? "You aren't a customer of any business yet."
                    : "You aren't listed as an employee on any business yet."}
            </p>
          )}

          <p className={styles.note}>
            <i className="ti ti-shield-check" aria-hidden="true" />
            Switching keeps you signed in - each role opens its own dashboard,
            and you can come back here any time.
          </p>
        </section>
      )}

      {showCreate && (
        <section className={styles.createWrap}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => {
              setShowCreate(false);
              setCreateError("");
            }}
          >
            <i className="ti ti-arrow-left" aria-hidden="true" /> Back to
            accounts
          </button>

          <div className={styles.createHead}>
            <span className={styles.eyebrow}>NEW WORKSPACE</span>
            <h3>Create a business</h3>
            <p>
              This creates a new, separate business - you'll be its owner, and
              it stays fully independent from any other business you're
              connected to.
            </p>
          </div>

          {createError && (
            <div className={styles.errorBox} role="alert">
              <i className="ti ti-alert-circle" aria-hidden="true" />
              <span>{createError}</span>
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="biz-name">Business name</label>
              <input
                id="biz-name"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Acme Corporation"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="biz-email">Business email</label>
              <input
                id="biz-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="hello@acme.com"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="biz-phone">
                Phone <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="biz-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+234 800 000 0000"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="biz-address">
                Address <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="biz-address"
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
        </section>
      )}
    </div>
  );

  // ── Customers: the customer shell (same nav as their dashboard) ────────
  if (isCustomer) {
    return (
      <>
        <CustomerShell
          tab={null}
          accountsActive
          title="My Accounts"
          onNavigate={customerNavigate}
          firstName={customerProfile?.firstName}
          lastName={customerProfile?.lastName}
          profileImage={profileImage}
          onProfileImageChange={handleCustomerProfileImageChange}
          unread={inbox.total}
          onSignOut={handleLogout}
        >
          {content}
        </CustomerShell>
      </>
    );
  }

  // ── Employers / employees: their dashboard's own shell ─────────────────
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
        <div className={`${dash.topbar} ${styles.clearTopbar}`}>
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

        <div className={dash.content}>{content}</div>
      </div>

      {/* ── Mobile bottom navigation ──
          The SAME MobileNavHub the employer / employee dashboards use (Home ·
          People · Operations · Messages · More), so this page's phone nav is
          identical to the one on the dashboard the person came from. Picking a
          destination goes back to that dashboard on the chosen section. */}
      <MobileNavHub
        role={isAdmin ? "employer" : "employee"}
        activeNav="/my-accounts"
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
