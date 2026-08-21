import { useState, useEffect, useCallback } from "react";
import {
  getEmployeeLocations,
  updateEmployeeLocations,
  getEmployeeScheduleAtBranch,
  updateEmployeeScheduleAtBranch,
} from "../api/branchApi";
import {
  getEmploymentSettings,
  updateEmploymentSchedule,
} from "../api/employmentApi";
import { getBranches } from "../api/branchApi";
import employmentStyles from "./EmploymentTab.module.css";
import styles from "./LocationsTab.module.css";

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

// One location's weekly schedule editor — identical day-row markup to
// EmploymentTab's part-time schedule (same CSS module reused on purpose),
// just pointed at whichever fetch/save pair fits this location: the
// original business-wide employment-settings endpoints for the main
// business, or the new branch-scoped ones for a specific branch.
function LocationScheduleEditor({ branchId, employeeId, employeeName }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDay, setSavingDay] = useState(null);

  const isMainBusiness = branchId === null;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      if (isMainBusiness) {
        const { data } = await getEmploymentSettings(employeeId);
        setSchedule(data.weeklySchedule ? sortDays(data.weeklySchedule) : []);
      } else {
        const { data } = await getEmployeeScheduleAtBranch(
          branchId,
          employeeId,
        );
        setSchedule(sortDays(data));
      }
    } catch {
      setError("Couldn't load this location's schedule.");
    } finally {
      setLoading(false);
    }
  }, [branchId, employeeId, isMainBusiness]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDayUpdate = async (day, patch) => {
    const updated = { ...day, ...patch };
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === day.dayOfWeek ? updated : d)),
    );
    setSavingDay(day.dayOfWeek);
    setError("");
    const payload = {
      dayOfWeek: updated.dayOfWeek,
      clockInTime: updated.clockInTime,
      clockOutTime: updated.clockOutTime,
      enabled: updated.enabled,
    };
    try {
      if (isMainBusiness) {
        await updateEmploymentSchedule(employeeId, payload);
      } else {
        await updateEmployeeScheduleAtBranch(branchId, employeeId, payload);
      }
    } catch {
      setError("Couldn't save that day. Reverting.");
      load();
    } finally {
      setSavingDay(null);
    }
  };

  if (loading)
    return <div className={employmentStyles.loading}>Loading schedule…</div>;
  if (error && !schedule) {
    return (
      <div className={employmentStyles.errorBanner}>
        <i className="ti ti-alert-circle" aria-hidden="true" />
        {error}
      </div>
    );
  }

  return (
    <div className={styles.scheduleEditorWrap}>
      {error && (
        <div className={employmentStyles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}
      <div className={employmentStyles.dayList}>
        {schedule?.map((day) => (
          <div key={day.dayOfWeek} className={employmentStyles.dayRow}>
            <div className={employmentStyles.dayToggle}>
              <label className={employmentStyles.switch}>
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) =>
                    handleDayUpdate(day, { enabled: e.target.checked })
                  }
                />
                <span className={employmentStyles.slider} />
              </label>
              <span
                className={
                  day.enabled
                    ? employmentStyles.dayLabel
                    : employmentStyles.dayLabelDisabled
                }
              >
                {DAY_LABELS[day.dayOfWeek]}
              </span>
            </div>

            <div className={employmentStyles.timeFields}>
              <div className={employmentStyles.timeField}>
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
              <div className={employmentStyles.timeField}>
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

            {!day.enabled && (
              <span className={employmentStyles.offTag}>Day off</span>
            )}
            {savingDay === day.dayOfWeek && (
              <span className={employmentStyles.savingTag}>Saving…</span>
            )}
          </div>
        ))}
      </div>
      <p className={styles.scheduleHint}>
        {employeeName || "This employee"} will only be expected to clock in at
        this location on the days turned on above.
      </p>
    </div>
  );
}

// One row in the locations list — a card that expands to its own schedule
// editor. branchId === null means "the main business".
function LocationCard({ location, employeeId, employeeName, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);

  return (
    <div className={styles.locationCard}>
      <button
        type="button"
        className={styles.locationCardHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.locationIcon}>
          <i
            className={
              location.branchId ? "ti ti-building-store" : "ti ti-building"
            }
            aria-hidden="true"
          />
        </span>
        <div className={styles.locationInfo}>
          <span className={styles.locationName}>{location.branchName}</span>
          {!location.hasSchedule && (
            <span className={styles.noScheduleTag}>No schedule set yet</span>
          )}
        </div>
        <i
          className={`ti ti-chevron-down ${styles.locationChevron} ${open ? styles.locationChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.locationCardBody}>
          <LocationScheduleEditor
            branchId={location.branchId}
            employeeId={employeeId}
            employeeName={employeeName}
          />
        </div>
      )}
    </div>
  );
}

// The "Just this branch" vs "Multiple locations" editor — a checklist
// (main business + every branch), not a native multi-select, so it reads
// clearly and matches the app's custom-control conventions elsewhere.
function EditLocationsPanel({
  employeeId,
  currentLocations,
  onSaved,
  onCancel,
}) {
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [includeMain, setIncludeMain] = useState(
    currentLocations.some((l) => l.branchId === null),
  );
  const [selectedBranchIds, setSelectedBranchIds] = useState(
    new Set(
      currentLocations
        .filter((l) => l.branchId !== null)
        .map((l) => l.branchId),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBranches()
      .then(({ data }) => setBranches(data))
      .catch(() => setError("Couldn't load your branches."))
      .finally(() => setLoadingBranches(false));
  }, []);

  const totalSelected = (includeMain ? 1 : 0) + selectedBranchIds.size;
  const isMulti = totalSelected > 1;

  const toggleBranch = (id) => {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (totalSelected === 0) {
      setError("Select at least one location.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await updateEmployeeLocations(employeeId, {
        includeMainBusiness: includeMain,
        branchIds: Array.from(selectedBranchIds),
      });
      onSaved(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't save these locations. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.editPanel}>
      <p className={styles.editPanelDesc}>
        Choose every location this employee is responsible for attendance at.
        Selecting more than one automatically makes them{" "}
        <strong>part-time</strong> — full-time employment only applies to a
        single location, since a full-timer's hours are already covered by one
        place.
      </p>

      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={includeMain}
          onChange={(e) => setIncludeMain(e.target.checked)}
        />
        <span className={styles.checkIcon}>
          <i className="ti ti-building" aria-hidden="true" />
        </span>
        Main business
      </label>

      {loadingBranches ? (
        <p className={styles.editPanelHint}>Loading branches…</p>
      ) : branches.length === 0 ? (
        <p className={styles.editPanelHint}>No branches created yet.</p>
      ) : (
        branches.map((b) => (
          <label key={b.id} className={styles.checkRow}>
            <input
              type="checkbox"
              checked={selectedBranchIds.has(b.id)}
              onChange={() => toggleBranch(b.id)}
              disabled={b.status === "INACTIVE"}
            />
            <span className={styles.checkIcon}>
              <i className="ti ti-building-store" aria-hidden="true" />
            </span>
            {b.name}
            {b.status === "INACTIVE" && (
              <span className={styles.inactiveTag}>Inactive</span>
            )}
          </label>
        ))
      )}

      {isMulti && (
        <div className={styles.partTimeNotice}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          {totalSelected} locations selected — this employee will be set to
          part-time, and you'll be able to set a separate schedule for each
          location below.
        </div>
      )}

      {error && (
        <div className={employmentStyles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className={styles.editPanelActions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save locations"}
        </button>
      </div>
    </div>
  );
}

export default function LocationsTab({
  employeeId,
  employeeName,
  canManage = true,
}) {
  const [locations, setLocations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await getEmployeeLocations(employeeId);
      setLocations(data);
    } catch {
      setError("Couldn't load this employee's locations.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className={employmentStyles.loading}>Loading locations…</div>;
  }

  const isMulti = (locations || []).length > 1;

  return (
    <div className={employmentStyles.wrap}>
      {error && (
        <div className={employmentStyles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className={employmentStyles.section}>
        <div className={styles.headerRow}>
          <div>
            <h4 className={employmentStyles.sectionTitle}>Liable locations</h4>
            <p className={employmentStyles.sectionDesc}>
              Everywhere {employeeName || "this employee"} is expected to clock
              in. Add a second location to make them part-time across multiple
              places.
            </p>
          </div>
          {!editing && canManage && (
            <button
              type="button"
              className={styles.editLocationsBtn}
              onClick={() => setEditing(true)}
            >
              <i className="ti ti-pencil" aria-hidden="true" /> Edit locations
            </button>
          )}
        </div>

        {isMulti && (
          <div className={styles.multiBanner}>
            <i className="ti ti-clock-hour-4" aria-hidden="true" />
            Part-time across {locations.length} locations — each has its own
            schedule below.
          </div>
        )}

        {editing ? (
          <EditLocationsPanel
            employeeId={employeeId}
            currentLocations={locations || []}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setLocations(updated);
              setEditing(false);
            }}
          />
        ) : (
          <div className={styles.locationList}>
            {(locations || []).map((loc) => (
              <LocationCard
                key={loc.branchId ?? "main"}
                location={loc}
                employeeId={employeeId}
                employeeName={employeeName}
                defaultOpen={!loc.hasSchedule}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
