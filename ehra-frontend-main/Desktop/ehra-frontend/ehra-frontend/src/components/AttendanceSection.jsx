import { useState, useEffect, useCallback, useRef } from "react";
import AttendanceTable from "./AttendanceTable";
import ScheduleSettings from "./ScheduleSettings";
import { getTodayAttendance, getAttendanceHistory } from "../api/attendanceApi";
import styles from "./AttendanceSection.module.css";

const TABS = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "settings", label: "Schedule settings" },
];

function toISODate(d) {
  return d.toISOString().split("T")[0];
}

export default function AttendanceSection() {
  const [tab, setTab] = useState("today");
  const rootRef = useRef(null);

  const [todayRecords, setTodayRecords] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);

  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  });
  const [toDate, setToDate] = useState(() => toISODate(new Date()));

  const fetchToday = useCallback(async () => {
    try {
      setLoadingToday(true);
      const { data } = await getTodayAttendance();
      setTodayRecords(data);
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const { data } = await getAttendanceHistory(fromDate, toDate);
      setHistoryRecords(data);
    } catch (err) {
      console.error("Failed to load attendance history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchToday();
    // Refresh today's view every 30s so admin sees new scans without manual reload
    const interval = setInterval(fetchToday, 30000);
    return () => clearInterval(interval);
  }, [fetchToday]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  // Content now scrolls as one unit through the page-level
  // .contentFullNarrow wrapper rather than its own nested region, so
  // switching tabs no longer resets scroll position automatically — do
  // it explicitly on whichever ancestor is actually scrollable.
  useEffect(() => {
    let node = rootRef.current?.parentElement;
    while (node) {
      if (getComputedStyle(node).overflowY === "auto") {
        node.scrollTo({ top: 0, behavior: "instant" });
        break;
      }
      node = node.parentElement;
    }
  }, [tab]);

  return (
    <div className={styles.layout} ref={rootRef}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabBody}>
        {tab === "today" && (
          <AttendanceTable records={todayRecords} loading={loadingToday} />
        )}

        {tab === "history" && (
          <div>
            <div className={styles.historyFilters}>
              <div className={styles.dateField}>
                <label>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className={styles.dateField}>
                <label>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button className={styles.applyBtn} onClick={fetchHistory}>
                Apply
              </button>
            </div>
            <AttendanceTable
              records={historyRecords}
              loading={loadingHistory}
              showDate
            />
          </div>
        )}

        {tab === "settings" && <ScheduleSettings />}
      </div>
    </div>
  );
}
