import { useState, useRef, useEffect } from "react";
import { updateEmploymentType } from "../api/employmentApi";
import styles from "./EmploymentTypeCell.module.css";

/**
 * Quick Full-time / Part-time toggle shown on each employee's Workforce
 * grid card. Full editing of a part-time employee's personal schedule
 * lives on their profile page ("Employment" tab) — this is just a fast
 * way to flip the type without leaving the grid.
 *
 * Writes apply immediately (no approval chain) for both the employer and
 * an HOD — except an HOD can never change a fellow HOD's employment type;
 * the server enforces this, and the frontend disables the control
 * pre-emptively whenever the target employee is themselves an HOD and the
 * caller is not the employer.
 */
export default function EmploymentTypeCell({
  employee,
  mode = "employer",
  onAssigned,
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setError("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const type = employee.employmentType || "FULL_TIME";
  const isPartTime = type === "PART_TIME";
  const targetIsHod = employee.role === "HOD";
  const locked = mode === "hod" && targetIsHod;

  const handleSelect = async (newType) => {
    if (newType === type) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await updateEmploymentType(employee.id, newType);
      onAssigned(employee.id, { employmentType: data.employmentType });
      setOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update employment type.";
      setError(
        typeof msg === "string" ? msg : "Could not update employment type.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${isPartTime ? styles.partTime : styles.fullTime}`}
        onClick={() => !locked && setOpen((v) => !v)}
        disabled={locked || saving}
        title={
          locked
            ? "Only the employer can change employment type for a Head of Department"
            : "Click to change employment type"
        }
      >
        <i
          className={`ti ${isPartTime ? "ti-clock-hour-4" : "ti-briefcase"}`}
        />
        {isPartTime ? "Part-time" : "Full-time"}
        {!locked && (
          <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
        )}
      </button>

      {open && (
        <div className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleSelect("FULL_TIME")}
            disabled={saving}
          >
            <i className="ti ti-briefcase" />
            Full-time
            {!isPartTime && (
              <i className="ti ti-check" style={{ marginLeft: "auto" }} />
            )}
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleSelect("PART_TIME")}
            disabled={saving}
          >
            <i className="ti ti-clock-hour-4" />
            Part-time
            {isPartTime && (
              <i className="ti ti-check" style={{ marginLeft: "auto" }} />
            )}
          </button>
        </div>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
