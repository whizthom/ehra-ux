import { useEffect, useState, useCallback } from "react";
import {
  getEmploymentSettings,
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

/**
 * "Schedule" tab on the employee profile page.
 *
 * Lets the employer or the employee's HOD set which days a PART-TIME
 * employee is expected to clock in, and the clock-in/clock-out times for
 * each day. Every toggle/time change is saved to the server as soon as
 * it's made (PUT /employees/{id}/employment-schedule) and the on-screen
 * state is updated from that response immediately — no page refresh is
 * ever needed to see the change take effect.
 *
 * Full-time employees don't have a personal schedule (they follow the
 * company-wide one), so this tab shows a pointer to the Edit Profile tab
 * instead, where the employment type can be switched to Part-time first.
 */
export default function AttendanceScheduleTab({
  employeeId,
  onGoToEditProfile,
}) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
        "Could not load the attendance schedule.";
      setError(
        typeof msg === "string"
          ? msg
          : "Could not load the attendance schedule.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleDayUpdate = async (day, patch) => {
    if (!settings?.canEdit) return;
    const updated = { ...day, ...patch };

    // Apply immediately in the UI — no refresh required.
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
      fetchSettings(); // revert to server state on failure
    } finally {
      setSavingDay(null);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading schedule…</div>;
  }

  if (!settings) {
    return (
      <div className={styles.errorBanner}>
        <i className="ti ti-alert-circle" aria-hidden="true" />
        {error || "Could not load the attendance schedule."}
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
            employer can change the attendance schedule for a fellow HOD.
          </span>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {isPartTime ? (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Personal weekly schedule</h4>
          <p className={styles.sectionDesc}>
            Turn on the days {settings.employeeFirstName || "this employee"} is
            expected to work, and set clock-in / clock-out times for each. Days
            left off are never counted as absent or late. Changes apply
            immediately.
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
            {settings.employeeFirstName || "This employee"} is currently
            Full-time and follows the standard company-wide schedule. Switch
            them to Part-time in the Edit Profile tab to set a personal
            attendance schedule here.
          </span>
          {onGoToEditProfile && (
            <button
              type="button"
              className={styles.savingTag}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#0f6e56",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: 12.5,
              }}
              onClick={onGoToEditProfile}
            >
              Go to Edit Profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
