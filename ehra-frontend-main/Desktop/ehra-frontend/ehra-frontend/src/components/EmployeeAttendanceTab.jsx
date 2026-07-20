import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAttendance } from "../api/attendanceApi";
import AttendanceTable from "./AttendanceTable";
import styles from "./EmployeeAttendanceTab.module.css";

// The employer's `AttendanceSection` pulls the company-wide "who clocked
// in today" view via GET /attendance/today (ADMIN only). An employee
// session can never call that — this is the correct replacement, scoped
// to the signed-in employee's own record via GET /attendance/me.
export default function EmployeeAttendanceTab() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await getMyAttendance();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load my attendance:", err);
      setError("Couldn't load your attendance history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const today = records.find((r) => {
    const d = new Date(r.date || r.clockIn);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>My attendance</h2>
          <p className={styles.subtitle}>
            Your clock-in history. Use the QR scanner to clock in or out.
          </p>
        </div>
        <button
          type="button"
          className={styles.scanBtn}
          onClick={() => navigate("/my-attendance")}
        >
          <i className="ti ti-scan" /> Scan to clock in / out
        </button>
      </div>

      <div className={styles.todayCard}>
        <span className={styles.todayLabel}>Today</span>
        {today ? (
          <div className={styles.todayRow}>
            <span>
              <i className="ti ti-login-2" /> In:{" "}
              {today.clockIn
                ? new Date(today.clockIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
            <span>
              <i className="ti ti-logout" /> Out:{" "}
              {today.clockOut
                ? new Date(today.clockOut).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
            <span className={styles.todayStatus}>{today.status}</span>
          </div>
        ) : (
          <p className={styles.todayEmpty}>You haven't clocked in yet today.</p>
        )}
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.panel}>
        <AttendanceTable
          records={records}
          loading={loading}
          showDate
          hideIdentityMobile
        />
      </div>
    </div>
  );
}
