import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./SelectDropdown.module.css";

/**
 * A themeable dropdown panel standing in for a native <select>. The
 * browser's native option list always renders as plain OS chrome (light
 * or dark regardless of the app's theme, no room for icons/avatars), so
 * anywhere the app needs a nicer picker uses this instead — same
 * value/onChange contract as ReportDropdown, generalized so it can carry
 * either a Tabler icon or an avatar-style initials badge per option.
 *
 * options: [{ value, label, sublabel?, icon?: "ti-xyz", initials?: "AB" }]
 */
export default function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = "Select…",
  emptyText = "No options available",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState("bottom");
  const ref = useRef(null);
  const menuRef = useRef(null);

  const current = options.find((o) => String(o.value) === String(value));

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => String(o.value) === String(value));
      setHighlight(idx >= 0 ? idx : 0);

      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const estMenuHeight = Math.min(260, options.length * 40 + 12);
        // Reserve room for the fixed mobile bottom nav (+ its safe-area
        // inset) so the menu flips upward before it would ever need to
        // render underneath it.
        const bottomBuffer = 96;
        const spaceBelow = viewportH - rect.bottom - bottomBuffer;
        setPlacement(spaceBelow < estMenuHeight ? "top" : "bottom");
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && highlight >= 0 && menuRef.current) {
      const el = menuRef.current.children[highlight];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlight, open]);

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) {
        onChange(opt.value);
        close();
      }
    }
  };

  return (
    <div
      className={`${styles.wrap} ${disabled ? styles.wrapDisabled : ""} ${className}`}
      ref={ref}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {current?.icon && (
          <i
            className={`ti ${current.icon} ${styles.triggerIcon}`}
            aria-hidden="true"
          />
        )}
        {current?.initials && (
          <span className={styles.avatar}>{current.initials}</span>
        )}
        <span className={styles.triggerLabel}>
          {current ? current.label : placeholder}
        </span>
        <i
          className={`ti ti-chevron-down ${styles.chevron} ${
            open ? styles.chevronOpen : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`${styles.menu} ${placement === "top" ? styles.menuTop : ""}`}
          role="listbox"
          ref={menuRef}
        >
          {options.length === 0 ? (
            <div className={styles.emptyRow}>{emptyText}</div>
          ) : (
            options.map((o, i) => {
              const active = String(o.value) === String(value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.option} ${active ? styles.optionActive : ""} ${
                    highlight === i ? styles.optionHighlight : ""
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                >
                  {o.icon && (
                    <i
                      className={`ti ${o.icon} ${styles.optionIcon}`}
                      aria-hidden="true"
                    />
                  )}
                  {o.initials && (
                    <span className={styles.avatar}>{o.initials}</span>
                  )}
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{o.label}</span>
                    {o.sublabel && (
                      <span className={styles.optionSublabel}>
                        {o.sublabel}
                      </span>
                    )}
                  </span>
                  {active && (
                    <i
                      className={`ti ti-check ${styles.check}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
