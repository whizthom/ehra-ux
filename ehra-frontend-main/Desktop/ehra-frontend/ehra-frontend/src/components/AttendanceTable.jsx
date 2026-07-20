import styles from "./AttendanceTable.module.css";

const STATUS_STYLES = {
  PRESENT: { label: "Present", cls: "pillPresent" },
  LATE: { label: "Late", cls: "pillLate" },
  EARLY_LEAVE: { label: "Early leave", cls: "pillEarly" },
  ABSENT: { label: "Absent", cls: "pillAbsent" },
};

function formatTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Renders as e.g. "May 4, 2026". Parsed via the Y/M/D components directly
// (rather than `new Date(dateStr)`) so a plain "yyyy-MM-dd" string from the
// backend can't shift a day off in timezones behind UTC.
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const datePart = String(dateStr).split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

export default function AttendanceTable({
  records,
  loading,
  showDate = false,
  // Mobile-only: hides the Employee and Department columns, leaving just
  // Date/Clock in/Clock out/Status. Meant for self-scoped views (e.g. the
  // employee's own "My attendance" tab) where every row is already known
  // to be the signed-in person — those columns are safe to keep on
  // desktop but redundant clutter on a narrow phone screen.
  hideIdentityMobile = false,
}) {
  if (loading) {
    return <div className={styles.loading}>Loading attendance…</div>;
  }

  if (!records || records.length === 0) {
    return (
      <div className={styles.empty}>
        <i
          className="ti ti-calendar-off"
          style={{ fontSize: 28 }}
          aria-hidden="true"
        />
        <p>No attendance records yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableScroll}>
      <table
        className={`${styles.table} ${hideIdentityMobile ? styles.hideIdentityMobile : ""}`}
      >
        <thead>
          <tr>
            <th className={styles.identityCol}>Employee</th>
            <th className={styles.identityCol}>Department</th>
            {showDate && <th>Date</th>}
            <th>Clock in</th>
            <th>Clock out</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const status = STATUS_STYLES[r.status] || STATUS_STYLES.PRESENT;
            return (
              <tr key={r.id}>
                <td className={styles.identityCol}>
                  <div className={styles.empCell}>
                    <div className={styles.avatar}>
                      {r.employeeProfilePictureUrl ? (
                        <img src={r.employeeProfilePictureUrl} alt="" />
                      ) : (
                        initials(r.employeeFirstName, r.employeeLastName)
                      )}
                    </div>
                    <div>
                      <div className={styles.empName}>
                        {r.employeeFirstName} {r.employeeLastName}
                      </div>
                      <div className={styles.empEmail}>{r.employeeEmail}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.identityCol}>
                  {r.department || "Unassigned"}
                </td>
                {showDate && <td>{formatDate(r.date)}</td>}
                <td className={styles.muted}>{formatTime(r.clockIn)}</td>
                <td className={styles.muted}>{formatTime(r.clockOut)}</td>
                <td>
                  <span className={`${styles.pill} ${styles[status.cls]}`}>
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
