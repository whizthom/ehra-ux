import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAttendance } from "../api/attendanceApi";
import AttendanceTable from "../components/AttendanceTable";
import styles from "./MyAttendanceHistory.module.css";

export default function MyAttendanceHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getMyAttendance();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load attendance history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/my-attendance")}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back to scan
        </button>
        <h1 className={styles.title}>My attendance history</h1>
      </div>

      <div className={styles.panel}>
        <AttendanceTable records={records} loading={loading} showDate />
      </div>
    </div>
  );
}
