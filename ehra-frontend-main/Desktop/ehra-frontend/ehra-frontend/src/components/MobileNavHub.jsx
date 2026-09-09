import { useEffect, useMemo, useState } from "react";
import styles from "./MobileNavHub.module.css";

const employerPeople = [
  { key: "Workforce", label: "Employees", icon: "ti-users", description: "View and manage your workforce." },
  { key: "Departments", label: "Departments", icon: "ti-building", description: "Organise teams and department heads." },
  { key: "Branches", label: "Branches", icon: "ti-building-store", description: "Manage your business locations." },
  { key: "Profile Edits", label: "Profile Edits", icon: "ti-user-edit", description: "Review requested employee changes." },
];

const employerOperations = [
  { key: "Attendance", label: "Attendance", icon: "ti-calendar-check", description: "See who is present, late or absent." },
  { key: "Leave", label: "Leave", icon: "ti-calendar-event", description: "Review requests and manage time off." },
  { key: "Payroll", label: "Payroll", icon: "ti-cash-banknote", description: "Run and review employee payroll." },
  { key: "Penalty", label: "Penalty", icon: "ti-coins", description: "Review attendance-related deductions." },
  { key: "Reports", label: "Reports", icon: "ti-chart-bar", description: "Turn business records into reports." },
  { key: "QR Code", label: "QR Code", icon: "ti-qrcode", description: "Access your attendance QR tools." },
];

const employeePeople = [
  { key: "Workforce", label: "My Team", icon: "ti-users", description: "View your department team.", hodOnly: true },
  { key: "Departments", label: "Department", icon: "ti-building", description: "View your department.", hodOnly: true },
];

const employeeOperations = [
  { key: "Attendance", label: "Attendance", icon: "ti-calendar-check", description: "View and manage your attendance." },
  { key: "Leave", label: "Leave", icon: "ti-calendar-event", description: "Request and track time off." },
  { key: "Cover Requests", label: "Cover Requests", icon: "ti-user-shield", description: "Manage requests assigned to you." },
  { key: "Penalty", label: "Penalty", icon: "ti-cash-banknote", description: "View your attendance deductions." },
];

const employerMore = [
  {
    title: "Business",
    items: [
      { key: "My profile", label: "Business Profile", icon: "ti-building", description: "Business details and settings." },
      { route: "/pricing", label: "Plans & Subscription", icon: "ti-credit-card", description: "Manage your Ehral plan." },
    ],
  },
  {
    title: "Account",
    items: [
      { key: "Notifications", label: "Notifications", icon: "ti-bell", description: "Review important updates." },
      { route: "/my-accounts", label: "My Accounts", icon: "ti-switch-horizontal", description: "Switch or manage your workspaces." },
    ],
  },
  {
    title: "Support",
    items: [{ route: "/support", label: "Help & Support", icon: "ti-headset", description: "Get help with Ehral." }],
  },
];

const employeeMore = [
  {
    title: "Account",
    items: [
      { key: "My Profile", label: "My Profile", icon: "ti-user-circle", description: "View and manage your profile." },
      { key: "Notifications", label: "Notifications", icon: "ti-bell", description: "Review important updates." },
      { route: "/my-accounts", label: "My Accounts", icon: "ti-switch-horizontal", description: "Switch or manage your workspaces." },
    ],
  },
  {
    title: "Support",
    items: [{ route: "/support", label: "Help & Support", icon: "ti-headset", description: "Get help with Ehral." }],
  },
];

function getPrimary(activeNav, role) {
  if (activeNav === "Messages") return "Messages";
  if (activeNav === "Dashboard" || activeNav === "Ehral Intelligence") return "Home";
  if (role === "employer") {
    if (["Workforce", "Departments", "Branches", "Profile Edits"].includes(activeNav)) return "People";
    if (["Attendance", "Leave", "Payroll", "Penalty", "Reports", "QR Code"].includes(activeNav)) return "Operations";
  } else {
    if (["Workforce", "Departments"].includes(activeNav)) return "People";
    if (["Attendance", "Leave", "Cover Requests", "Penalty"].includes(activeNav)) return "Operations";
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

  useEffect(() => {
    setHub(null);
  }, [activeNav]);

  const people = useMemo(
    () => (role === "employer" ? employerPeople : employeePeople).filter((item) => !item.hodOnly || isHod),
    [role, isHod],
  );
  const operations = role === "employer" ? employerOperations : employeeOperations;
  const more = role === "employer" ? employerMore : employeeMore;
  const primary = getPrimary(activeNav, role);

  const selectItem = (item) => {
    setHub(null);
    if (item.route) {
      navigate(item.route, {
        state: { returnPath: role === "employer" ? "/dashboard" : "/my-dashboard", activeNav },
      });
      return;
    }
    if (item.key) setActiveNav(item.key);
  };

  const openPrimary = (destination) => {
    if (destination === "Home") {
      setHub(null);
      setActiveNav("Dashboard");
      return;
    }
    if (destination === "Messages") {
      setHub(null);
      setActiveNav("Messages");
      return;
    }
    setHub((current) => (current === destination ? null : destination));
  };

  const badgeFor = (key) => Number(badges[key] || 0);

  return (
    <>
      <div className={`${styles.scrim} ${hub ? styles.scrimVisible : ""}`} onClick={() => setHub(null)} aria-hidden="true" />

      <div className={`${styles.sheet} ${hub ? styles.sheetOpen : ""}`} role={hub ? "dialog" : undefined} aria-modal={hub ? "true" : undefined} aria-label={hub ? `${hub} menu` : undefined}>
        {hub && (
          <>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div>
                <span className={styles.eyebrow}>{hub === "More" ? "EHRAL" : hub.toUpperCase()}</span>
                <h2>{hub === "People" ? "People" : hub === "Operations" ? "Operations" : "More"}</h2>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setHub(null)} aria-label="Close menu">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {hub === "People" && (
              <div className={styles.itemList}>
                {people.map((item) => (
                  <NavRow key={item.key} item={item} badge={badgeFor(item.key)} active={activeNav === item.key} onClick={() => selectItem(item)} />
                ))}
              </div>
            )}

            {hub === "Operations" && (
              <div className={styles.itemList}>
                {operations.map((item) => (
                  <NavRow key={item.key} item={item} badge={badgeFor(item.key)} active={activeNav === item.key} onClick={() => selectItem(item)} />
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
                        <NavRow key={item.key || item.route} item={item} badge={badgeFor(item.key)} active={activeNav === item.key} onClick={() => selectItem(item)} />
                      ))}
                    </div>
                  </section>
                ))}
                <button type="button" className={styles.logoutRow} onClick={() => { setHub(null); onLogout?.(); }}>
                  <span className={styles.iconBox}><i className="ti ti-logout" aria-hidden="true" /></span>
                  <span><strong>Log out</strong><small>Sign out of this Ehral session.</small></span>
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <nav className={`${styles.bottomNav} ${hidden ? styles.hidden : ""}`} aria-label="Primary mobile navigation">
        <div className={styles.bottomNavInner}>
          <NavButton icon="ti-home" label="Home" active={primary === "Home"} onClick={() => openPrimary("Home")} />
          <NavButton icon="ti-users" label="People" active={primary === "People"} badge={role === "employer" ? badgeFor("Profile Edits") : 0} onClick={() => openPrimary("People")} />
          <NavButton icon="ti-layout-grid" label="Operations" active={primary === "Operations"} onClick={() => openPrimary("Operations")} />
          <NavButton icon="ti-message-circle" label="Messages" active={primary === "Messages"} badge={badgeFor("Messages")} onClick={() => openPrimary("Messages")} />
          <NavButton icon="ti-dots" label="More" active={primary === "More"} badge={badgeFor("Notifications")} onClick={() => openPrimary("More")} />
        </div>
      </nav>
    </>
  );
}

function NavButton({ icon, label, active, badge, onClick }) {
  return (
    <button type="button" className={`${styles.navButton} ${active ? styles.navActive : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <span className={styles.navIconWrap}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        {badge > 0 && <span className={styles.navBadge}>{badge > 9 ? "9+" : badge}</span>}
      </span>
      <span>{label}</span>
    </button>
  );
}

function NavRow({ item, badge, active, onClick }) {
  return (
    <button type="button" className={`${styles.itemRow} ${active ? styles.itemActive : ""}`} onClick={onClick}>
      <span className={styles.iconBox}><i className={`ti ${item.icon}`} aria-hidden="true" /></span>
      <span className={styles.itemCopy}><strong>{item.label}</strong><small>{item.description}</small></span>
      {badge > 0 && <span className={styles.rowBadge}>{badge > 99 ? "99+" : badge}</span>}
      <i className="ti ti-chevron-right" aria-hidden="true" />
    </button>
  );
}
