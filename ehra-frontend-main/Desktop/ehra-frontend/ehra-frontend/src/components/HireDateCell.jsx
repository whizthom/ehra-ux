import { useState, useRef, useEffect } from "react";
import {
  assignHireDateByEmployer,
  assignHireDateByHod,
} from "../api/profileEditApi";
import styles from "./PositionCell.module.css";

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Renders an employee's hire date as a clickable pill. Clicking opens an
 * inline date field to set/change it. Mirrors PositionCell exactly —
 * hire date is never editable by the employee themselves, only by the
 * employer or their HOD.
 *
 * mode="employer" — change applies immediately.
 * mode="hod"      — change is submitted for the employer's approval; the
 *                    cell shows a "pending approval" state until decided.
 */
export default function HireDateCell({
  employee,
  mode = "employer",
  onAssigned,
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(employee.hireDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setError("");
        setValue(employee.hireDate || "");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPending = !!employee.hireDatePending;

  const handleSave = async () => {
    if (!value || value === employee.hireDate) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } =
        mode === "hod"
          ? await assignHireDateByHod(employee.id, value)
          : await assignHireDateByEmployer(employee.id, value);

      if (mode === "hod") {
        // Pending employer approval — don't change the live hire date yet.
        onAssigned(employee.id, {
          hireDatePending: true,
          pendingHireDate: data.newHireDate || value,
        });
      } else {
        onAssigned(employee.id, { hireDate: data.newHireDate || value });
      }
      setOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update hire date.";
      setError(typeof msg === "string" ? msg : "Could not update hire date.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setOpen(false);
      setError("");
      setValue(employee.hireDate || "");
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      {open ? (
        <div className={styles.editRow}>
          <input
            ref={inputRef}
            type="date"
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
          />
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
            aria-label="Save"
          >
            <i
              className={`ti ${saving ? "ti-loader-2 ti-spin" : "ti-check"}`}
            />
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              setOpen(false);
              setError("");
              setValue(employee.hireDate || "");
            }}
            disabled={saving}
            aria-label="Cancel"
          >
            <i className="ti ti-x" />
          </button>
          {error && <span className={styles.error}>{error}</span>}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.trigger} ${!employee.hireDate ? styles.unset : ""}`}
          onClick={() => setOpen(true)}
          disabled={isPending}
          title={
            isPending
              ? "A hire date change is awaiting employer approval"
              : "Click to set hire date"
          }
        >
          {employee.hireDate ? fmt(employee.hireDate) : "No hire date set"}
          {!isPending && (
            <i className="ti ti-pencil" style={{ fontSize: 11 }} />
          )}
        </button>
      )}

      {isPending && !open && (
        <span className={styles.pendingBadge}>
          <i className="ti ti-clock" />
          {employee.pendingHireDate
            ? `Pending: ${fmt(employee.pendingHireDate)}`
            : "Pending approval"}
        </span>
      )}
    </div>
  );
}
