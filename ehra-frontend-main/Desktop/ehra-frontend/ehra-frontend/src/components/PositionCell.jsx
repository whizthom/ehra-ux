import { useState, useRef, useEffect } from "react";
import {
  assignPositionByEmployer,
  assignPositionByHod,
} from "../api/profileEditApi";
import styles from "./PositionCell.module.css";

/**
 * Renders an employee's position (job title) as a clickable pill.
 * Clicking opens an inline text field to set/change it.
 *
 * mode="employer" — change applies immediately.
 * mode="hod"      — change is submitted for the employer's approval;
 *                    the cell shows a "pending approval" state until
 *                    it's decided.
 */
export default function PositionCell({
  employee,
  mode = "employer",
  onAssigned,
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(employee.position || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setError("");
        setValue(employee.position || "");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPending = !!employee.positionPending;

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === employee.position) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } =
        mode === "hod"
          ? await assignPositionByHod(employee.id, trimmed)
          : await assignPositionByEmployer(employee.id, trimmed);

      if (mode === "hod") {
        // Pending employer approval — don't change the live position yet.
        onAssigned(employee.id, {
          positionPending: true,
          pendingPosition: data.newPosition || trimmed,
        });
      } else {
        onAssigned(employee.id, { position: data.newPosition || trimmed });
      }
      setOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update position.";
      setError(typeof msg === "string" ? msg : "Could not update position.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setOpen(false);
      setError("");
      setValue(employee.position || "");
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      {open ? (
        <div className={styles.editRow}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Job title"
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
              setValue(employee.position || "");
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
          className={`${styles.trigger} ${!employee.position ? styles.unset : ""}`}
          onClick={() => setOpen(true)}
          disabled={isPending}
          title={
            isPending
              ? "A position change is awaiting employer approval"
              : "Click to set position"
          }
        >
          {employee.position || "No title set"}
          {!isPending && (
            <i className="ti ti-pencil" style={{ fontSize: 11 }} />
          )}
        </button>
      )}

      {isPending && !open && (
        <span className={styles.pendingBadge}>
          <i className="ti ti-clock" />
          {employee.pendingPosition
            ? `Pending: ${employee.pendingPosition}`
            : "Pending approval"}
        </span>
      )}
    </div>
  );
}
