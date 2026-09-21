import { useNavigate } from "react-router-dom";
import Logo from "./Logo";
import MobileNavHub from "./MobileNavHub";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import { CUSTOMER_NAV_ITEMS } from "../utils/customerNav";
import styles from "../pages/CustomerDashboard.module.css";

// The customer's app chrome - dark sidebar on desktop, top bar, and the
// five-item bottom navigation (MobileNavHub) on phones - in ONE place, so
// every customer screen (the dashboard, "My Accounts"...) wears exactly the
// same navigation and styling instead of each page carrying its own copy.
//
// It deliberately reuses CustomerDashboard.module.css: that stylesheet IS the
// customer chrome, and importing the same module gives the same class names,
// so the look can't drift between screens.

const initialsOf = (first, last) =>
  `${first || ""} ${last || ""}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

/**
 * Props
 *   tab             active dashboard tab id, or null on a screen that isn't a tab
 *   title           text for the top bar heading
 *   onNavigate(id)  called with a tab id when a nav item / brand / avatar is used
 *   firstName, lastName, unread
 *   onSignOut       sign out (already confirmed by the caller if it wants to)
 *   accountsActive  highlights "Switch account" (used by the My Accounts screen)
 *   topActionsBefore  optional node rendered before the theme toggle (e.g. search)
 *   banner          optional node between the top bar and the content (toasts)
 *   contentClassName  extra class for the content wrapper
 */
export default function CustomerShell({
  tab,
  title,
  onNavigate,
  firstName,
  lastName,
  unread = 0,
  onSignOut,
  accountsActive = false,
  topActionsBefore = null,
  banner = null,
  contentClassName = "",
  children,
}) {
  const nav = useNavigate();
  const initials = initialsOf(firstName, lastName);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Logo size={62} variant="horizontal" tone="sidebar" title="Ehral" />
        </div>
        <div className={styles.profileMini}>
          <div className={styles.profileAvatar}>{initials}</div>
          <div>
            <strong>{firstName || "Customer"}</strong>
            <small>Customer account</small>
          </div>
        </div>
        <nav>
          {CUSTOMER_NAV_ITEMS.map(([id, label, icon]) => (
            <button
              key={id}
              className={tab === id ? styles.navActive : ""}
              onClick={() => onNavigate(id)}
            >
              <i className={`ti ti-${icon}`} />
              <span>{label}</span>
              {id === "messages" && unread > 0 && (
                <em>{unread > 9 ? "9+" : unread}</em>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <button onClick={() => onNavigate("account")}>
            <i className="ti ti-settings" /> Account settings
          </button>
          <button
            className={accountsActive ? styles.navActive : ""}
            onClick={() => nav("/my-accounts")}
          >
            <i className="ti ti-switch-horizontal" /> Switch account
          </button>
          <button onClick={onSignOut}>
            <i className="ti ti-logout-2" /> Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileBrand}
            onClick={() => onNavigate("home")}
          >
            <Logo size={48} variant="horizontal" tone="brand" title="Ehral" />
          </button>
          <div className={styles.topTitle}>
            <span>MY EHRAL</span>
            <h1>{title}</h1>
          </div>
          <div className={styles.topActions}>
            {topActionsBefore}
            {/* Light/dark switch - same self-contained component as the employer
                dashboard, so switching themes behaves identically everywhere. */}
            <ThemeToggleMenu />
            <button
              className={styles.avatarButton}
              onClick={() => onNavigate("account")}
              aria-label="Open account"
            >
              {initials}
            </button>
          </div>
        </header>

        {banner}

        <div className={`${styles.content} ${contentClassName}`}>
          {children}
        </div>
      </main>

      <MobileNavHub
        role="customer"
        activeNav={accountsActive ? "/my-accounts" : tab}
        setActiveNav={onNavigate}
        navigate={nav}
        badges={{ Messages: unread }}
        onLogout={onSignOut}
      />
    </div>
  );
}
