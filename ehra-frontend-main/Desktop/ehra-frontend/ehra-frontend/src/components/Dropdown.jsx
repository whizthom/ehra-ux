import { useState, useRef, useEffect } from "react";
import styles from "./Dropdown.module.css";

/**
 * A styled listbox standing in for a native <select> — browsers render
 * <select> options with zero styling control (system font, system
 * colors, no icons), which is exactly what looks out of place next to a
 * custom-designed form. This renders entirely with our own markup instead.
 *
 * @param {{value: string, label: string, icon?: string, description?: string}[]} options
 * @param {string} value - the selected option's value
 * @param {(value: string) => void} onChange
 */
export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerContent}>
          {selected?.icon && (
            <i className={`ti ${selected.icon} ${styles.triggerIcon}`} />
          )}
          <span
            className={
              selected ? styles.triggerLabel : styles.triggerPlaceholder
            }
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <i className={`ti ti-chevron-down ${styles.triggerChevron}`} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`${styles.option} ${opt.value === value ? styles.optionActive : ""}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.icon && (
                <i className={`ti ${opt.icon} ${styles.optionIcon}`} />
              )}
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{opt.label}</span>
                {opt.description && (
                  <span className={styles.optionDescription}>
                    {opt.description}
                  </span>
                )}
              </span>
              {opt.value === value && (
                <i className={`ti ti-check ${styles.optionCheck}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
