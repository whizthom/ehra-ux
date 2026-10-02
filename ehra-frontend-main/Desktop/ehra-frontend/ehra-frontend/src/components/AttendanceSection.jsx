import { useState, useEffect, useCallback, useRef } from "react";
import AttendanceTable from "./AttendanceTable";
import ScheduleSettings from "./ScheduleSettings";
import { getTodayAttendance, getAttendanceHistory } from "../api/attendanceApi";
import styles from "./AttendanceSection.module.css";
import AttendanceSecurityPanel from "./AttendanceSecurityPanel";
import useVisibleInterval from "../hooks/useVisibleInterval";
import useCacheWrite from "../hooks/useCacheWrite";
import { hasFreshCache, seedFromCache } from "../utils/viewCache";

const TODAY_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

const TABS = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "settings", label: "Schedule settings" },
  { key: "security", label: "Attendance security" },
];

export default function AttendanceSection() {
  const [tab, setTab] = useState("today");
  const rootRef = useRef(null);

  // "Today" is live data, so it only paints from the view cache when the
  // cached copy is recent (the Dashboard keeps it fresh while open).
  // fetchToday still runs on every mount and every poll.
  const [todayRecords, setTodayRecords] = useState(() => seedFromCache("attendance:today", [], TODAY_CACHE_MAX_AGE_MS));
  useCacheWrite("attendance:today", todayRecords);
  const [loadingToday, setLoadingToday] = useState(
    () => !hasFreshCache("attendance:today", TODAY_CACHE_MAX_AGE_MS),
  );
  // Once today's list has loaded in this view, later polls refresh it in
  // place instead of blanking it behind a spinner every 30 seconds.
  const todayLoadedRef = useRef(false);

  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Empty by default so History loads every attendance record for every
  // employee, past to present - same "show everything unless narrowed"
  // behavior as the employee's own attendance tab (GET /attendance/me).
  // Only once the admin picks both a From and To date does the view
  // narrow to that range.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchToday = useCallback(async () => {
    try {
      if (!todayLoadedRef.current && !hasFreshCache("attendance:today", TODAY_CACHE_MAX_AGE_MS)) {
        setLoadingToday(true);
      }
      const { data } = await getTodayAttendance();
      setTodayRecords(data);
      todayLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      // Only pass a date range once both ends are set; otherwise fetch
      // the business's full, unbounded history (past to present) for
      // every employee.
      const { data } = await getAttendanceHistory(
        fromDate || undefined,
        toDate || undefined,
      );
      setHistoryRecords(data);
    } catch (err) {
      console.error("Failed to load attendance history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [fromDate, toDate]);

  const clearHistoryFilter = () => {
    setFromDate("");
    setToDate("");
  };

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  // Refresh today's view every 30s so admin sees new scans without manual
  // reload - paused while the tab is hidden (see useVisibleInterval).
  useVisibleInterval(fetchToday, 30000);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  // Content now scrolls as one unit through the page-level
  // .contentFullNarrow wrapper rather than its own nested region, so
  // switching tabs no longer resets scroll position automatically - do
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
              {(fromDate || toDate) && (
                <button
                  className={styles.applyBtn}
                  onClick={clearHistoryFilter}
                >
                  Show all
                </button>
              )}
            </div>
            <AttendanceTable
              records={historyRecords}
              loading={loadingHistory}
              showDate
            />
          </div>
        )}

        {tab === "settings" && <ScheduleSettings />}

        {tab === "security" && <AttendanceSecurityPanel />}
      </div>
    </div>
  );
}
