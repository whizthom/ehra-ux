import { useState, useRef, useEffect } from "react";
import styles from "./CustomSelect.module.css";

/**
 * Fully custom dropdown — replaces native <select> everywhere so the menu
 * always matches the app's own styling instead of the OS/browser popup.
 *
 * options: [{ value, label, icon? }]
 * Supports optional search (searchable) and optional leading icon per option.
 */
export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search…",
  emptyLabel = "No options",
  triggerClassName = "",
  align = "left", // "left" | "right"
  renderOption, // optional custom row renderer(option, isSelected)
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered =
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options;

  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(
        Math.max(
          0,
          filtered.findIndex((o) => o.value === value),
        ),
      );
      if (searchable) {
        setTimeout(() => searchRef.current?.focus(), 10);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (opt) => {
    onChange(opt ? opt.value : null);
    setOpen(false);
  };

  const handleTriggerKey = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight]);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${triggerClassName} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.icon && (
          <i
            className={`ti ${selected.icon} ${styles.triggerIcon}`}
            aria-hidden="true"
          />
        )}
        <span
          className={selected ? styles.triggerValue : styles.triggerPlaceholder}
        >
          {selected ? selected.label : placeholder}
        </span>
        <i
          className={`ti ti-chevron-down ${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`${styles.panel} ${align === "right" ? styles.panelRight : ""}`}
          role="listbox"
        >
          {searchable && (
            <div className={styles.searchRow}>
              <i className="ti ti-search" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={handleListKey}
              />
            </div>
          )}

          <div className={styles.optionsList} ref={listRef}>
            {filtered.length === 0 && (
              <div className={styles.emptyOption}>{emptyLabel}</div>
            )}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <button
                  type="button"
                  key={String(opt.value)}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${i === highlight ? styles.optionHighlight : ""}`}
                  onClick={() => commit(opt)}
                  onMouseEnter={() => setHighlight(i)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {renderOption ? (
                    renderOption(opt, isSelected)
                  ) : (
                    <>
                      {opt.icon && (
                        <i className={`ti ${opt.icon}`} aria-hidden="true" />
                      )}
                      <span>{opt.label}</span>
                      {isSelected && (
                        <i
                          className={`ti ti-check ${styles.checkIcon}`}
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
