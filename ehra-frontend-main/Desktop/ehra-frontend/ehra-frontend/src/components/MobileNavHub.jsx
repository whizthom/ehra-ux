import { useEffect, useMemo, useState } from "react";
import styles from "./MobileNavHub.module.css";

const employerPeople = [
  {
    key: "Workforce",
    label: "Employees",
    icon: "ti-users",
    description: "Employees and roles.",
  },
  {
    key: "Departments",
    label: "Departments",
    icon: "ti-building",
    description: "Teams and department heads.",
  },
  {
    key: "Branches",
    label: "Branches",
    icon: "ti-building-store",
    description: "Locations and teams.",
  },
  {
    key: "Profile Edits",
    label: "Profile Edits",
    icon: "ti-user-edit",
    description: "Changes awaiting review.",
  },
];

const employerOperations = [
  {
    key: "Attendance",
    label: "Attendance",
    icon: "ti-calendar-check",
    description: "Presence and attendance.",
  },
  {
    key: "Leave",
    label: "Leave",
    icon: "ti-calendar-event",
    description: "Requests and time off.",
  },
  {
    key: "Payroll",
    label: "Payroll",
    icon: "ti-cash-banknote",
    description: "Pay, review and reconcile.",
  },
  {
    key: "Penalty",
    label: "Penalty",
    icon: "ti-coins",
    description: "Attendance deductions.",
  },
  {
    key: "Reports",
    label: "Reports",
    icon: "ti-chart-bar",
    description: "Reports and insights.",
  },
  {
    key: "QR Code",
    label: "QR Code",
    icon: "ti-qrcode",
    description: "Attendance QR tools.",
  },
  {
    key: "Products",
    label: "Products",
    icon: "ti-package",
    description: "Manage your product catalog.",
  },
  {
    key: "Orders",
    label: "Orders",
    icon: "ti-shopping-cart",
    description: "Review storefront orders.",
  },
  {
    key: "Customers",
    label: "Customers",
    icon: "ti-users-group",
    description: "Customer relationships.",
  },
  {
    key: "Storefront",
    label: "Storefront",
    icon: "ti-world",
    description: "Publish your public store.",
  },
];

const employeePeople = [
  {
    key: "Workforce",
    label: "My Team",
    icon: "ti-users",
    description: "View your department team.",
    hodOnly: true,
  },
  {
    key: "Departments",
    label: "Department",
    icon: "ti-building",
    description: "View your department.",
    hodOnly: true,
  },
];

const employeeOperations = [
  {
    key: "Attendance",
    label: "Attendance",
    icon: "ti-calendar-check",
    description: "View and manage your attendance.",
  },
  {
    key: "Leave",
    label: "Leave",
    icon: "ti-calendar-event",
    description: "Request and track time off.",
  },
  {
    key: "Cover Requests",
    label: "Cover Requests",
    icon: "ti-user-shield",
    description: "Manage requests assigned to you.",
  },
  {
    key: "Penalty",
    label: "Penalty",
    icon: "ti-cash-banknote",
    description: "View your attendance deductions.",
  },
];

const employerMore = [
  {
    title: "Business",
    items: [
      {
        key: "My profile",
        label: "Business Profile",
        icon: "ti-building",
        description: "Business details and settings.",
      },
      {
        route: "/pricing",
        label: "Plans & Subscription",
        icon: "ti-credit-card",
        description: "Manage your Ehral plan.",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        key: "Notifications",
        label: "Notifications",
        icon: "ti-bell",
        description: "Review important updates.",
      },
      {
        route: "/my-accounts",
        label: "My Accounts",
        icon: "ti-switch-horizontal",
        description: "Switch or manage your workspaces.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        route: "/support",
        label: "Help & Support",
        icon: "ti-headset",
        description: "Get help with Ehral.",
      },
    ],
  },
];

const employeeMore = [
  {
    title: "Account",
    items: [
      {
        key: "My Profile",
        label: "My Profile",
        icon: "ti-user-circle",
        description: "View and manage your profile.",
      },
      {
        key: "Notifications",
        label: "Notifications",
        icon: "ti-bell",
        description: "Review important updates.",
      },
      {
        route: "/my-accounts",
        label: "My Accounts",
        icon: "ti-switch-horizontal",
        description: "Switch or manage your workspaces.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        route: "/support",
        label: "Help & Support",
        icon: "ti-headset",
        description: "Get help with Ehral.",
      },
    ],
  },
];

const customerPeople = [
  {
    key: "discover",
    label: "Discover",
    icon: "ti-compass",
    description: "Find businesses and services.",
  },
  {
    key: "businesses",
    label: "My Businesses",
    icon: "ti-building-store",
    description: "Businesses you use on Ehral.",
  },
];

const customerOperations = [
  {
    key: "approvals",
    label: "Approvals",
    icon: "ti-clipboard-check",
    description: "Review and approve carts sent from the counter.",
  },
  {
    key: "orders",
    label: "Orders",
    icon: "ti-shopping-bag",
    description: "Track your purchases and orders.",
  },
  {
    key: "receipts",
    label: "Receipts",
    icon: "ti-receipt",
    description: "View and download your receipts.",
  },
  {
    key: "spending",
    label: "Spending",
    icon: "ti-chart-donut",
    description: "Understand your Ehral spending.",
  },
];

const customerMore = [
  {
    title: "Account",
    items: [
      {
        key: "account",
        label: "Account",
        icon: "ti-user-circle",
        description: "Manage your Ehral customer account.",
      },
      {
        route: "/my-accounts",
        label: "My Accounts",
        icon: "ti-switch-horizontal",
        description: "Switch or manage your Ehral workspaces.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        route: "/support",
        label: "Help & Support",
        icon: "ti-headset",
        description: "Get help with Ehral.",
      },
    ],
  },
];

function getPrimary(activeNav, role) {
  if (activeNav === "messages") return "Messages";
  if (activeNav === "home") return "Home";
  if (role === "customer") {
    if (["discover", "businesses"].includes(activeNav)) return "Businesses";
    if (["approvals", "orders", "receipts", "spending"].includes(activeNav)) return "Orders";
  } else if (role === "employer") {
    if (
      ["Workforce", "Departments", "Branches", "Profile Edits"].includes(
        activeNav,
      )
    )
      return "People";
    if (
      [
        "Attendance",
        "Leave",
        "Payroll",
        "Penalty",
        "Reports",
        "QR Code",
        "Products",
        "Orders",
        "Customers",
        "Storefront",
      ].includes(activeNav)
    )
      return "Operations";
  } else {
    if (["Workforce", "Departments"].includes(activeNav)) return "People";
    if (
      ["Attendance", "Leave", "Cover Requests", "Penalty"].includes(activeNav)
    )
      return "Operations";
  }
  return "More";
}

export default function MobileNavHub({
  role = "employer",
  activeNav,
  setActiveNav,
  navigate,
  hidden = false,
  badges = {},
  isHod = false,
  onLogout,
}) {
  const [hub, setHub] = useState(null);

  // Always derive the active hub from the current destination. This keeps the
  // five-item mobile navigation synchronized when the parent changes tabs.
  useEffect(() => {
    setHub(null);
  }, [activeNav]);

  const people = useMemo(
    () =>
      (role === "employer"
        ? employerPeople
        : role === "customer"
          ? customerPeople
          : employeePeople
      ).filter((item) => !item.hodOnly || isHod),
    [role, isHod],
  );
  const operations =
    role === "employer"
      ? employerOperations
      : role === "customer"
        ? customerOperations
        : employeeOperations;
  const more =
    role === "employer"
      ? employerMore
      : role === "customer"
        ? customerMore
        : employeeMore;
  const primary = getPrimary(activeNav, role);

  const selectItem = (item) => {
    setHub(null);
    if (item.route) {
      navigate(item.route, {
        state: {
          returnPath:
            role === "employer"
              ? "/dashboard"
              : role === "customer"
                ? "/customer-dashboard"
                : "/my-dashboard",
          activeNav,
        },
      });
      return;
    }
    if (item.key) setActiveNav(item.key);
  };

  const openPrimary = (destination) => {
    if (destination === "Home") {
      setHub(null);
      const homeKey = role === "customer" ? "home" : "Dashboard";
      if (activeNav !== homeKey) setActiveNav(homeKey);
      return;
    }
    if (destination === "Messages") {
      setHub(null);
      setActiveNav(role === "customer" ? "messages" : "Messages");
      return;
    }
    setHub((current) => (current === destination ? null : destination));
  };

  const badgeFor = (key) => Number(badges[key] || 0);

  return (
    <>
      <div
        className={`${styles.scrim} ${hub ? styles.scrimVisible : ""}`}
        onClick={() => setHub(null)}
        aria-hidden="true"
      />

      <div
        className={`${styles.sheet} ${hub ? styles.sheetOpen : ""}`}
        role={hub ? "dialog" : undefined}
        aria-modal={hub ? "true" : undefined}
        aria-label={hub ? `${hub} menu` : undefined}
      >
        {hub && (
          <>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHeaderCopy}>
                <span className={styles.eyebrow}>
                  {hub === "More" ? "EHRAL" : hub.toUpperCase()}
                </span>
                <h2>
                  {hub === "People"
                    ? "People"
                    : hub === "Businesses"
                      ? "Businesses"
                      : hub === "Operations"
                        ? "Operations"
                        : hub === "Orders"
                          ? "Orders"
                          : "More"}
                </h2>
                <p>
                  {hub === "People"
                    ? "Keep your people organised."
                    : hub === "Businesses"
                      ? "Discover and manage your business relationships."
                      : hub === "Operations"
                        ? "Run the work that matters."
                        : hub === "Orders"
                          ? "Keep your purchases and spending organised."
                          : "Everything else, in one place."}
                </p>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => setHub(null)}
                aria-label="Close menu"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {(hub === "People" || hub === "Businesses") && (
              <div className={styles.itemList}>
                {people.map((item) => (
                  <NavRow
                    key={item.key}
                    item={item}
                    badge={badgeFor(item.key)}
                    active={activeNav === item.key}
                    onClick={() => selectItem(item)}
                  />
                ))}
              </div>
            )}

            {(hub === "Operations" || hub === "Orders") && (
              <div className={styles.itemList}>
                {operations.map((item) => (
                  <NavRow
                    key={item.key}
                    item={item}
                    badge={badgeFor(item.key)}
                    active={activeNav === item.key}
                    onClick={() => selectItem(item)}
                  />
                ))}
              </div>
            )}

            {hub === "More" && (
              <div className={styles.moreGroups}>
                {more.map((group) => (
                  <section key={group.title} className={styles.moreGroup}>
                    <h3>{group.title}</h3>
                    <div className={styles.itemList}>
                      {group.items.map((item) => (
                        <NavRow
                          key={item.key || item.route}
                          item={item}
                          badge={badgeFor(item.key)}
                          active={
                            activeNav === item.key ||
                            Boolean(item.route && activeNav === item.route)
                          }
                          onClick={() => selectItem(item)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <button
                  type="button"
                  className={styles.logoutRow}
                  onClick={() => {
                    setHub(null);
                    onLogout?.();
                  }}
                >
                  <span className={styles.iconBox}>
                    <i className="ti ti-logout" aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Log out</strong>
                    <small>Sign out of this Ehral session.</small>
                  </span>
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <nav
        className={`${styles.bottomNav} ${hidden ? styles.hidden : ""}`}
        aria-label="Primary mobile navigation"
      >
        <div className={styles.bottomNavInner}>
          <NavButton
            icon="ti-home"
            label="Home"
            active={primary === "Home"}
            onClick={() => openPrimary("Home")}
          />
          <NavButton
            icon={role === "customer" ? "ti-building-store" : "ti-users"}
            label={role === "customer" ? "Businesses" : "People"}
            active={primary === (role === "customer" ? "Businesses" : "People")}
            badge={role === "employer" ? badgeFor("Profile Edits") : 0}
            onClick={() =>
              openPrimary(role === "customer" ? "Businesses" : "People")
            }
          />
          <NavButton
            icon={role === "customer" ? "ti-shopping-bag" : "ti-layout-grid"}
            label={role === "customer" ? "Orders" : "Operations"}
            active={primary === (role === "customer" ? "Orders" : "Operations")}
            onClick={() =>
              openPrimary(role === "customer" ? "Orders" : "Operations")
            }
          />
          <NavButton
            icon="ti-message-circle"
            label="Messages"
            active={primary === "Messages"}
            badge={badgeFor("Messages")}
            onClick={() => openPrimary("Messages")}
          />
          <NavButton
            icon="ti-dots"
            label="More"
            active={primary === "More"}
            badge={badgeFor("Notifications")}
            onClick={() => openPrimary("More")}
          />
        </div>
      </nav>
    </>
  );
}

function NavButton({ icon, label, active, badge, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.navButton} ${active ? styles.navActive : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.navIconWrap}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        {badge > 0 && (
          <span className={styles.navBadge}>{badge > 9 ? "9+" : badge}</span>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

function NavRow({ item, badge, active, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.itemRow} ${active ? styles.itemActive : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.iconBox}>
        <i className={`ti ${item.icon}`} aria-hidden="true" />
      </span>
      <span className={styles.itemCopy}>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      {badge > 0 && (
        <span className={styles.rowBadge}>{badge > 99 ? "99+" : badge}</span>
      )}
      <i className="ti ti-chevron-right" aria-hidden="true" />
    </button>
  );
}
