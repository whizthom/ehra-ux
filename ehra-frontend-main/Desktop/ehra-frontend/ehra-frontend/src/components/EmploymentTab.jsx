import { useState, useEffect, useCallback } from "react";
import {
  getEmploymentSettings,
  updateEmploymentType,
  updateEmploymentSchedule,
} from "../api/employmentApi";
import styles from "./EmploymentTab.module.css";

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

function sortDays(days) {
  return [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
  );
}

export default function EmploymentTab({ employeeId }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [savingDay, setSavingDay] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await getEmploymentSettings(employeeId);
      setSettings({
        ...data,
        weeklySchedule: data.weeklySchedule
          ? sortDays(data.weeklySchedule)
          : null,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not load employment settings.";
      setError(
        typeof msg === "string" ? msg : "Could not load employment settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleTypeChange = async (type) => {
    if (!settings || !settings.canEdit || type === settings.employmentType)
      return;
    setSavingType(true);
    setError("");
    try {
      const { data } = await updateEmploymentType(employeeId, type);
      setSettings({
        ...data,
        weeklySchedule: data.weeklySchedule
          ? sortDays(data.weeklySchedule)
          : null,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update employment type.";
      setError(
        typeof msg === "string" ? msg : "Could not update employment type.",
      );
    } finally {
      setSavingType(false);
    }
  };

  const handleDayUpdate = async (day, patch) => {
    if (!settings?.canEdit) return;
    const updated = { ...day, ...patch };
    setSettings((prev) => ({
      ...prev,
      weeklySchedule: prev.weeklySchedule.map((d) =>
        d.dayOfWeek === day.dayOfWeek ? updated : d,
      ),
    }));
    setSavingDay(day.dayOfWeek);
    setError("");
    try {
      await updateEmploymentSchedule(employeeId, {
        dayOfWeek: updated.dayOfWeek,
        clockInTime: updated.clockInTime,
        clockOutTime: updated.clockOutTime,
        enabled: updated.enabled,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not save that day's schedule.";
      setError(
        typeof msg === "string" ? msg : "Could not save that day's schedule.",
      );
      fetchSettings(); // revert to server state
    } finally {
      setSavingDay(null);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading employment settings…</div>;
  }

  if (!settings) {
    return (
      <div className={styles.errorBanner}>
        <i className="ti ti-alert-circle" aria-hidden="true" />
        {error || "Could not load employment settings."}
      </div>
    );
  }

  const isPartTime = settings.employmentType === "PART_TIME";

  return (
    <div className={styles.wrap}>
      {!settings.canEdit && (
        <div className={styles.infoBanner}>
          <i className="ti ti-shield-lock" aria-hidden="true" />
          <span>
            {settings.employeeFirstName} is a Head of Department — only the
            employer can change employment settings for a fellow HOD.
          </span>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Employment type ── */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Employment type</h4>
        <p className={styles.sectionDesc}>
          Determines how attendance is tracked for{" "}
          {settings.employeeFirstName || "this employee"}. Only the employer or
          their Head of Department can change this.
        </p>

        <div className={styles.typeGrid}>
          <button
            type="button"
            className={`${styles.typeCard} ${!isPartTime ? styles.typeCardActive : ""}`}
            onClick={() => handleTypeChange("FULL_TIME")}
            disabled={!settings.canEdit || savingType}
          >
            <div className={styles.typeIcon}>
              <i className="ti ti-briefcase" aria-hidden="true" />
            </div>
            <div className={styles.typeText}>
              <span className={styles.typeLabel}>Full-time</span>
              <span className={styles.typeDesc}>
                Follows the standard company-wide weekly schedule.
              </span>
            </div>
            {!isPartTime && (
              <i
                className={`ti ti-circle-check-filled ${styles.typeCheck}`}
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            className={`${styles.typeCard} ${isPartTime ? styles.typeCardActive : ""}`}
            onClick={() => handleTypeChange("PART_TIME")}
            disabled={!settings.canEdit || savingType}
          >
            <div className={styles.typeIcon}>
              <i className="ti ti-clock-hour-4" aria-hidden="true" />
            </div>
            <div className={styles.typeText}>
              <span className={styles.typeLabel}>Part-time</span>
              <span className={styles.typeDesc}>
                Uses a personalized schedule — attendance is only expected on
                the days set below.
              </span>
            </div>
            {isPartTime && (
              <i
                className={`ti ti-circle-check-filled ${styles.typeCheck}`}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
        {savingType && <span className={styles.savingTag}>Saving…</span>}
      </div>

      {/* ── Part-time weekly schedule ── */}
      {isPartTime ? (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Personal weekly schedule</h4>
          <p className={styles.sectionDesc}>
            Turn on the days {settings.employeeFirstName || "this employee"} is
            expected to work, and set clock-in / clock-out times for each. Days
            left off are never counted as absent or late.
          </p>

          <div className={styles.dayList}>
            {settings.weeklySchedule?.map((day) => (
              <div key={day.dayOfWeek} className={styles.dayRow}>
                <div className={styles.dayToggle}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      disabled={!settings.canEdit}
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
                      disabled={!day.enabled || !settings.canEdit}
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
                      disabled={!day.enabled || !settings.canEdit}
                      onChange={(e) =>
                        handleDayUpdate(day, { clockOutTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                {!day.enabled && <span className={styles.offTag}>Day off</span>}
                {savingDay === day.dayOfWeek && (
                  <span className={styles.savingTag}>Saving…</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.fullTimeNote}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>
            This employee follows the standard company-wide schedule. Switch to
            Part-time to set a personalized attendance schedule.
          </span>
        </div>
      )}
    </div>
  );
}
