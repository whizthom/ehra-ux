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

function fullName(first, last) {
  return [first, last].filter(Boolean).join(" ") || "Team member";
}

function timeLabel(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function titleCase(str) {
  return (str || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

// Turns the signed-in visitor's own real workspace data (see
// useLiveWorkspaceData) into the same {stats, rows} shape STATS/ROWS
// use, per screen. Returns null — never throws — whenever there isn't
// enough real data for a given screen, so the caller falls back to the
// static mock instead of rendering a half-empty real UI.
function deriveLive(screen, liveData) {
  if (!liveData?.live) return null;
  try {
    const { summary, attendance, leaves, announcements, isEmployer } = liveData;
    const activeStaff =
      summary?.activeEmployees ?? summary?.totalEmployees ?? null;
    const clockedIn = attendance
      ? attendance.filter((r) => r.clockIn).length
      : null;
    const late = attendance
      ? attendance.filter((r) => r.status === "LATE").length
      : null;
    const absent = attendance
      ? attendance.filter((r) => r.status === "ABSENT").length
      : 0;

    const activityRows = (attendance || [])
      .slice(0, 4)
      .map((r) => [
        fullName(r.employeeFirstName, r.employeeLastName),
        r.department || "Unassigned",
        r.clockIn
          ? `Checked in · ${timeLabel(r.clockIn) || ""}`
          : r.status === "ABSENT"
            ? "Absent"
            : "Not yet clocked in",
      ]);

    if (screen === "overview") {
      if (activeStaff == null && clockedIn == null) return null;
      return {
        stats: [
          {
            label: "Present today",
            value:
              activeStaff != null
                ? `${clockedIn ?? 0} / ${activeStaff}`
                : `${clockedIn ?? 0}`,
            tone: "accent",
          },
          {
            label: isEmployer ? "Pending leave" : "My leave requests",
            value: String(leaves?.length ?? 0),
            tone: "warning",
          },
          {
            label: "Announcements",
            value: String(announcements?.length ?? 0),
            tone: "info",
          },
        ],
        rows: activityRows.length ? activityRows : null,
      };
    }

    if (screen === "attendance") {
      if (clockedIn == null && activeStaff == null) return null;
      const withTimes = (attendance || [])
        .filter((r) => r.clockIn)
        .map((r) => new Date(r.clockIn))
        .filter((d) => !Number.isNaN(d.getTime()));
      let avgLabel = "—";
      if (withTimes.length) {
        const avgMinutes =
          withTimes.reduce(
            (sum, d) => sum + d.getHours() * 60 + d.getMinutes(),
            0,
          ) / withTimes.length;
        const avgDate = new Date();
        avgDate.setHours(0, Math.round(avgMinutes), 0, 0);
        avgLabel = avgDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return {
        stats: [
          {
            label: "Clocked in",
            value:
              activeStaff != null
                ? `${clockedIn ?? 0} / ${activeStaff}`
                : `${clockedIn ?? 0}`,
            tone: "accent",
          },
          { label: "Late arrivals", value: String(late ?? 0), tone: "warning" },
          { label: "Avg. check-in", value: avgLabel, tone: "info" },
        ],
        rows: (attendance || [])
          .slice(0, 4)
          .map((r) => [
            fullName(r.employeeFirstName, r.employeeLastName),
            r.department || "Unassigned",
            r.clockIn
              ? timeLabel(r.clockIn) || "—"
              : titleCase(r.status) || "—",
          ]),
      };
    }

    if (screen === "employees") {
      if (!summary) return null;
      return {
        stats: [
          {
            label: "Total employees",
            value: String(summary.totalEmployees ?? "—"),
            tone: "accent",
          },
          {
            label: "Active",
            value: String(summary.activeEmployees ?? "—"),
            tone: "info",
          },
          {
            label: "Pending approvals",
            value: String(summary.pendingApprovals ?? 0),
            tone: "warning",
          },
        ],
        rows: activityRows.length ? activityRows : null,
      };
    }

    if (screen === "leave") {
      if (!leaves) return null;
      const approved = leaves.filter((l) => l.status === "APPROVED").length;
      const pending = leaves.filter((l) => l.status === "PENDING").length;
      return {
        stats: [
          {
            label: isEmployer ? "Pending requests" : "My requests",
            value: String(pending || leaves.length),
            tone: "warning",
          },
          { label: "Approved", value: String(approved), tone: "accent" },
          {
            label: "Total on record",
            value: String(leaves.length),
            tone: "info",
          },
        ],
        rows: leaves
          .slice(0, 4)
          .map((l) => [
            isEmployer
              ? fullName(l.employeeFirstName, l.employeeLastName)
              : "You",
            titleCase(l.leaveType) || "Leave",
            titleCase(l.status) || "Pending",
          ]),
      };
    }

    if (screen === "reports") {
      if (activeStaff == null && clockedIn == null) return null;
      const rate = activeStaff
        ? Math.round(((clockedIn ?? 0) / activeStaff) * 100)
        : null;
      return {
        stats: [
          {
            label: "Attendance today",
            value: rate != null ? `${rate}%` : "—",
            tone: "accent",
          },
          {
            label: "Leave on record",
            value: String(leaves?.length ?? 0),
            tone: "info",
          },
          {
            label: "Flagged (late/absent)",
            value: String((late ?? 0) + absent),
            tone: "warning",
          },
        ],
        rows: activityRows.length ? activityRows : null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * A replica of the real Ehral business dashboard — same sidebar,
 * topbar, stat-card and table language used in Dashboard.module.css.
 *
 * Renders instantly from fixed sample data by default, so it's never
 * blocked on auth/network. When a `liveData` snapshot is passed in AND
 * has real data for this `screen` (see useLiveWorkspaceData — only
 * true when the visitor is actually signed in), it renders that real
 * data instead and shows a small "Live" indicator in place of the
 * static date pill.
 */
export default function DashboardPreview({ screen = "overview", liveData }) {
  const live = deriveLive(screen, liveData);
  const stats = live?.stats || STATS[screen] || STATS.overview;
  const rows = live?.rows || ROWS[screen] || ROWS.overview;
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
          {live ? (
            <span className={`${styles.pillToday} ${styles.pillLive}`}>
              <span className={styles.liveDot} aria-hidden="true" />
              Live · your data
            </span>
          ) : (
            <span className={styles.pillToday}>Today · Fri</span>
          )}
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
            <span className={styles.cardHeading}>
              {live ? "Today's activity" : "Recent activity"}
            </span>
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
