import { useState, useRef, useEffect } from "react";
import { assignEmployeeDepartment } from "../api/departmentApi";
import styles from "./DepartmentCell.module.css";

/**
 * Renders the employee's current department as a clickable pill.
 * Clicking opens a dropdown listing all departments for the business;
 * selecting one calls the assign API and updates the table in place.
 */
export default function DepartmentCell({ employee, departments, onAssigned }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = async (departmentId) => {
    setSaving(true);
    setOpen(false);
    try {
      const { data } = await assignEmployeeDepartment(
        employee.id,
        departmentId,
      );
      onAssigned(employee.id, data);
    } catch (err) {
      alert("Failed to update department. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isUnassigned = !employee.departmentId;

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${isUnassigned ? styles.unassigned : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
      >
        {saving ? "Saving…" : employee.department || "Unassigned"}
        <i
          className="ti ti-chevron-down"
          style={{ fontSize: 12 }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Assign department</div>

          <button
            type="button"
            className={`${styles.option} ${isUnassigned ? styles.optionActive : ""}`}
            onClick={() => handleSelect(null)}
          >
            <span
              className={styles.optionDot}
              style={{ background: "var(--border-color)" }}
            />
            Unassigned
          </button>

          {departments.length === 0 ? (
            <div className={styles.empty}>
              No departments yet. Create one first.
            </div>
          ) : (
            departments.map((dept) => (
              <button
                type="button"
                key={dept.id}
                className={`${styles.option} ${employee.departmentId === dept.id ? styles.optionActive : ""}`}
                onClick={() => handleSelect(dept.id)}
              >
                <span
                  className={styles.optionDot}
                  style={{ background: "var(--accent)" }}
                />
                {dept.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
