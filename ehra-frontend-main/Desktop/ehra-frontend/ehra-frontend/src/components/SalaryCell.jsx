import { useState, useRef, useEffect } from "react";
import { updateEmployeeSalary } from "../api/employmentApi";
import styles from "./SalaryCell.module.css";

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compact salary pill for the Workforce grid card — mirrors PositionCell's
 * click-to-edit pattern, but for the employee's salary.
 *
 * Employer only (the server enforces this too — an HOD can never view or
 * set salary). Writes apply immediately; the employee is notified of the
 * change, same as the full Edit Profile page's salary field.
 */
export default function SalaryCell({ employee, onAssigned }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    employee.salary != null ? String(employee.salary) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setError("");
        setValue(employee.salary != null ? String(employee.salary) : "");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed === "") {
      setError("Salary is required.");
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 0) {
      setError("Enter a valid, non-negative amount.");
      return;
    }
    if (employee.salary != null && num === Number(employee.salary)) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await updateEmployeeSalary(employee.id, num);
      onAssigned(employee.id, { salary: data.salary });
      setOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update salary.";
      setError(typeof msg === "string" ? msg : "Could not update salary.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setOpen(false);
      setError("");
      setValue(employee.salary != null ? String(employee.salary) : "");
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      {open ? (
        <div className={styles.editRow}>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 250000.00"
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
              setValue(employee.salary != null ? String(employee.salary) : "");
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
          className={`${styles.trigger} ${employee.salary == null ? styles.unset : ""}`}
          onClick={() => setOpen(true)}
          title="Click to set salary"
        >
          <i className="ti ti-currency-naira" style={{ fontSize: 12 }} />
          {formatSalary(employee.salary) ?? "No salary set"}
          <i className="ti ti-pencil" style={{ fontSize: 11 }} />
        </button>
      )}
    </div>
  );
}
