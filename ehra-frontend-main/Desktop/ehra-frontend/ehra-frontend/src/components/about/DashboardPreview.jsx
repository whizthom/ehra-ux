import styles from "./DashboardPreview.module.css";

const NAV = [
  { icon: "ti-layout-dashboard", label: "Overview" },
  { icon: "ti-users", label: "Employees" },
  { icon: "ti-fingerprint", label: "Attendance" },
  { icon: "ti-calendar-off", label: "Leave" },
  { icon: "ti-message-circle", label: "Messages" },
  { icon: "ti-report", label: "Reports" },
  { icon: "ti-settings", label: "Settings" },
];

const STATS = {
  overview: [
    { label: "Present today", value: "128", tone: "accent" },
    { label: "On leave", value: "6", tone: "warning" },
    { label: "Open positions", value: "3", tone: "info" },
  ],
  attendance: [
    { label: "Clocked in", value: "128 / 141", tone: "accent" },
    { label: "Late arrivals", value: "4", tone: "warning" },
    { label: "Avg. check-in", value: "8:52 AM", tone: "info" },
  ],
  employees: [
    { label: "Total employees", value: "141", tone: "accent" },
    { label: "Departments", value: "8", tone: "info" },
    { label: "New this month", value: "5", tone: "warning" },
  ],
  leave: [
    { label: "Pending requests", value: "3", tone: "warning" },
    { label: "Approved this month", value: "11", tone: "accent" },
    { label: "On leave today", value: "6", tone: "info" },
  ],
  reports: [
    { label: "Attendance rate", value: "94%", tone: "accent" },
    { label: "Leave taken (30d)", value: "22 days", tone: "info" },
    { label: "Flagged records", value: "2", tone: "warning" },
  ],
};

const ROWS = {
  overview: [
    ["Amaka O.", "Engineering", "Checked in · 9:02 AM"],
    ["Tunde B.", "Operations", "On leave"],
    ["Ngozi E.", "Design", "Checked in · 8:47 AM"],
    ["Femi A.", "Sales", "Checked in · 9:11 AM"],
  ],
  attendance: [
    ["Amaka O.", "Engineering", "9:02 AM"],
    ["Ngozi E.", "Design", "8:47 AM"],
    ["Femi A.", "Sales", "9:11 AM"],
    ["Chidi K.", "Sales", "9:24 AM · Late"],
  ],
  employees: [
    ["Amaka O.", "Engineering", "Full-time"],
    ["Tunde B.", "Operations", "Full-time"],
    ["Ngozi E.", "Design", "Contract"],
    ["Femi A.", "Sales", "Full-time"],
  ],
  leave: [
    ["Tunde B.", "Annual leave", "Awaiting HOD"],
    ["Chidi K.", "Sick leave", "Approved"],
    ["Bola S.", "Annual leave", "Awaiting employer"],
    ["Kemi J.", "Compassionate", "Approved"],
  ],
  reports: [
    ["Engineering", "97% attendance", "0 flags"],
    ["Operations", "91% attendance", "1 flag"],
    ["Sales", "95% attendance", "1 flag"],
    ["Design", "96% attendance", "0 flags"],
  ],
};

const bars = [38, 62, 44, 70, 55, 80, 60];

/**
 * A static, presentation-quality replica of the real Ehral business
 * dashboard — same sidebar, topbar, stat-card and table language used in
 * Dashboard.module.css, redrawn here with fixed sample data so it renders
 * instantly with no auth/API dependency. Not the live component: a visual
 * stand-in that shows a visitor "this is what your dashboard looks like"
 * without wiring up real business data.
 */
export default function DashboardPreview({ screen = "overview" }) {
  const stats = STATS[screen] || STATS.overview;
  const rows = ROWS[screen] || ROWS.overview;
  const activeLabel =
    {
      overview: "Overview",
      attendance: "Attendance",
      employees: "Employees",
      leave: "Leave",
      reports: "Reports",
    }[screen] || "Overview";

  return (
    <div className={styles.wrap}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <i className="ti ti-hexagon-letter-e" />
        </div>
        {NAV.map((item) => (
          <div
            key={item.label}
            className={`${styles.navItem} ${item.label === activeLabel ? styles.navActive : ""}`}
          >
            <i className={`ti ${item.icon}`} />
          </div>
        ))}
      </div>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <span className={styles.pageTitle}>{activeLabel}</span>
          <span className={styles.pillToday}>Today · Fri</span>
        </div>

        <div className={styles.statRow}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <span className={`${styles.statValue} ${styles[s.tone]}`}>
                {s.value}
              </span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          <div className={styles.chartCard}>
            <span className={styles.cardHeading}>This week</span>
            <div className={styles.chart}>
              {bars.map((h, i) => (
                <span
                  key={i}
                  className={styles.bar}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className={styles.tableCard}>
            <span className={styles.cardHeading}>Recent activity</span>
            <div className={styles.table}>
              {rows.map((r, i) => (
                <div key={i} className={styles.tableRow}>
                  <span className={styles.avatar}>{r[0].charAt(0)}</span>
                  <span className={styles.rowName}>{r[0]}</span>
                  <span className={styles.rowMeta}>{r[1]}</span>
                  <span className={styles.rowStatus}>{r[2]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
