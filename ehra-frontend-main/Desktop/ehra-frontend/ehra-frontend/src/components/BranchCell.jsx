import { useState, useRef, useEffect } from "react";
import { assignEmployeeBranch } from "../api/branchApi";
import styles from "./DepartmentCell.module.css";

/**
 * Renders the employee's current branch as a clickable pill — same
 * interaction as DepartmentCell (deliberately reuses its CSS module too,
 * so the two pills sit consistently side by side in the Workforce table).
 * Clicking opens a dropdown listing every branch for the business;
 * selecting one calls the assign API and updates the table in place.
 */
export default function BranchCell({ employee, branches, onAssigned }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = async (branchId) => {
    setSaving(true);
    setOpen(false);
    setError(false);
    try {
      const { data } = await assignEmployeeBranch(employee.id, branchId);
      onAssigned(employee.id, data);
    } catch (err) {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const isUnassigned = !employee.branchId;

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${isUnassigned ? styles.unassigned : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title={error ? "Failed to update branch. Please try again." : undefined}
      >
        {saving
          ? "Saving…"
          : error
            ? "Failed — retry"
            : employee.branch || "Unassigned"}
        <i
          className="ti ti-chevron-down"
          style={{ fontSize: 12 }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Assign branch</div>

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

          {branches.length === 0 ? (
            <div className={styles.empty}>
              No branches yet. Create one first.
            </div>
          ) : (
            branches.map((branch) => (
              <button
                type="button"
                key={branch.id}
                className={`${styles.option} ${employee.branchId === branch.id ? styles.optionActive : ""}`}
                onClick={() => handleSelect(branch.id)}
                disabled={branch.status === "INACTIVE"}
                title={
                  branch.status === "INACTIVE"
                    ? "This branch is inactive"
                    : undefined
                }
              >
                <span
                  className={styles.optionDot}
                  style={{
                    background:
                      branch.status === "INACTIVE"
                        ? "var(--warning-text)"
                        : "var(--accent)",
                  }}
                />
                {branch.name}
                {branch.status === "INACTIVE" && (
                  <span
                    style={{ marginLeft: "auto", fontSize: 10, opacity: 0.7 }}
                  >
                    Inactive
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
