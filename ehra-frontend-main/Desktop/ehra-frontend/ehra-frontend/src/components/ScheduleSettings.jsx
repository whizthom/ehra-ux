import { useEffect, useState, useCallback } from "react";
import {
  getWeeklySchedule,
  updateDaySchedule,
  getHolidays,
  addHoliday,
  deleteHoliday,
} from "../api/attendanceApi";
import styles from "./ScheduleSettings.module.css";

const DAY_LABELS = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export default function ScheduleSettings() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDay, setSavingDay] = useState(null);

  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");

    // Fetched independently (not Promise.all) so that one endpoint
    // failing — e.g. holidays erroring — can never blank out the weekly
    // schedule, which previously happened because Promise.all rejects
    // as a whole if either call fails, silently skipping both setState
    // calls with no error shown to the user.
    const [scheduleResult, holidaysResult] = await Promise.allSettled([
      getWeeklySchedule(),
      getHolidays(),
    ]);

    if (scheduleResult.status === "fulfilled") {
      setSchedule(
        scheduleResult.value.data.sort(
          (a, b) =>
            DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
        ),
      );
    } else {
      console.error("Failed to load weekly schedule:", scheduleResult.reason);
    }

    if (holidaysResult.status === "fulfilled") {
      setHolidays(holidaysResult.value.data);
    } else {
      console.error("Failed to load holidays:", holidaysResult.reason);
    }

    if (scheduleResult.status === "rejected") {
      const msg =
        scheduleResult.reason?.response?.data?.message ||
        scheduleResult.reason?.response?.data ||
        "Could not load the weekly schedule.";
      setError(
        typeof msg === "string" ? msg : "Could not load the weekly schedule.",
      );
    } else if (holidaysResult.status === "rejected") {
      const msg =
        holidaysResult.reason?.response?.data?.message ||
        holidaysResult.reason?.response?.data ||
        "Could not load holidays.";
      setError(typeof msg === "string" ? msg : "Could not load holidays.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDayUpdate = async (day, patch) => {
    const updated = { ...day, ...patch };
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === day.dayOfWeek ? updated : d)),
    );
    setSavingDay(day.dayOfWeek);
    try {
      await updateDaySchedule({
        dayOfWeek: updated.dayOfWeek,
        clockInTime: updated.clockInTime,
        clockOutTime: updated.clockOutTime,
        enabled: updated.enabled,
      });
    } catch (err) {
      console.error("Failed to save day schedule:", err);
      fetchAll(); // revert to server state on failure
    } finally {
      setSavingDay(null);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate) return;
    setAddingHoliday(true);
    try {
      const { data } = await addHoliday({
        date: newHolidayDate,
        label: newHolidayLabel,
      });
      setHolidays((prev) =>
        [...prev, data].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setNewHolidayDate("");
      setNewHolidayLabel("");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to add holiday.";
      alert(typeof msg === "string" ? msg : "Failed to add holiday.");
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    try {
      await deleteHoliday(id);
    } catch (err) {
      console.error("Failed to delete holiday:", err);
      fetchAll();
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading schedule…</div>;
  }

  return (
    <div className={styles.wrap}>
      {error && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
          <button type="button" className={styles.retryBtn} onClick={fetchAll}>
            Retry
          </button>
        </div>
      )}

      {/* ── Weekly schedule ── */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Weekly working hours</h4>
        <p className={styles.sectionDesc}>
          Set clock-in and clock-out times for each day. Disable a day to turn
          off clock-in entirely (e.g. weekends).
        </p>

        {schedule.length === 0 ? (
          <p className={styles.noHolidays}>
            {error
              ? "Schedule couldn't be loaded — tap Retry above."
              : "No schedule configured yet."}
          </p>
        ) : (
          <div className={styles.dayList}>
            {schedule.map((day) => (
              <div key={day.dayOfWeek} className={styles.dayRow}>
                <div className={styles.dayToggle}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) =>
                        handleDayUpdate(day, { enabled: e.target.checked })
                      }
                    />
                    <span className={styles.slider} />
                  </label>
                  <span
                    className={
                      day.enabled ? styles.dayLabel : styles.dayLabelDisabled
                    }
                  >
                    {DAY_LABELS[day.dayOfWeek]}
                  </span>
                </div>

                <div className={styles.timeFields}>
                  <div className={styles.timeField}>
                    <label>Clock in</label>
                    <input
                      type="time"
                      value={day.clockInTime || ""}
                      disabled={!day.enabled}
                      onChange={(e) =>
                        handleDayUpdate(day, { clockInTime: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.timeField}>
                    <label>Clock out</label>
                    <input
                      type="time"
                      value={day.clockOutTime || ""}
                      disabled={!day.enabled}
                      onChange={(e) =>
                        handleDayUpdate(day, { clockOutTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                {savingDay === day.dayOfWeek && (
                  <span className={styles.savingTag}>Saving…</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Holidays ── */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Holidays & days off</h4>
        <p className={styles.sectionDesc}>
          Add specific dates where clock-in is disabled, regardless of the
          weekly schedule.
        </p>

        <div className={styles.holidayForm}>
          <div className={styles.holidayField}>
            <label htmlFor="holiday-date">Date</label>
            <input
              id="holiday-date"
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className={styles.holidayDateInput}
            />
          </div>
          <div className={styles.holidayFieldGrow}>
            <label htmlFor="holiday-label">Holiday name</label>
            <input
              id="holiday-label"
              type="text"
              placeholder="e.g. Independence Day"
              value={newHolidayLabel}
              onChange={(e) => setNewHolidayLabel(e.target.value)}
              className={styles.holidayLabelInput}
            />
          </div>
          <button
            type="button"
            className={styles.addHolidayBtn}
            onClick={handleAddHoliday}
            disabled={!newHolidayDate || addingHoliday}
          >
            {addingHoliday ? "Adding…" : "Add"}
          </button>
        </div>

        <div className={styles.holidayList}>
          {holidays.length === 0 ? (
            <p className={styles.noHolidays}>No holidays configured yet.</p>
          ) : (
            holidays.map((h) => (
              <div key={h.id} className={styles.holidayItem}>
                <div>
                  <span className={styles.holidayDate}>{h.date}</span>
                  {h.label && (
                    <span className={styles.holidayLabel}> — {h.label}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.removeHolidayBtn}
                  onClick={() => handleDeleteHoliday(h.id)}
                  aria-label="Remove holiday"
                >
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
