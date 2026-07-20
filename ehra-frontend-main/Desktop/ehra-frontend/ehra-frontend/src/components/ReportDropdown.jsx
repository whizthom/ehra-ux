import { useState, useRef, useEffect } from "react";
import styles from "./ReportsTab.module.css";

/**
 * A themeable dropdown panel standing in for a native <select>. The
 * browser's native option list can't be restyled (it always renders as
 * plain OS chrome, light or dark regardless of the app's theme), so every
 * report filter uses this instead.
 *
 * value/onChange behave like a native select: onChange receives the raw
 * string value of whichever option was picked, and the caller converts
 * it (e.g. Number(...)) if needed — same as reading e.target.value.
 */
export default function ReportDropdown({
  icon,
  value,
  options,
  onChange,
  className = "",
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const current = options.find((o) => String(o.value) === String(value));

  return (
    <div className={`${styles.reportDropdown} ${className}`} ref={ref}>
      <button
        type="button"
        className={styles.reportDropdownTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
        <span className={styles.reportDropdownLabel}>
          {current ? current.label : "Select…"}
        </span>
        <i
          className={`ti ti-chevron-down ${styles.reportDropdownChevron} ${
            open ? styles.reportDropdownChevronOpen : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`${styles.reportDropdownMenu} ${
            align === "right" ? styles.reportDropdownMenuRight : ""
          }`}
          role="listbox"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={`${styles.reportDropdownOption} ${
                String(o.value) === String(value)
                  ? styles.reportDropdownOptionActive
                  : ""
              }`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {String(o.value) === String(value) && (
                <i
                  className={`ti ti-check ${styles.reportDropdownCheck}`}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
