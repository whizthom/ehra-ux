import { useEffect, useMemo, useRef, useState } from "react";
import c from "./CategorySelect.module.css";

// A premium, responsive replacement for a native <select> popup: lets the
// user pick from a curated list, pick from categories they've already used
// before (passed in via `extra`), or type a brand new category that isn't
// in either list yet. Used for both product categories and expense
// categories so the business is never boxed into a fixed list.
function CategorySelect({
  label,
  value,
  onChange,
  options = [],
  extra = [],
  placeholder = "Select or add a category",
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const merged = useMemo(() => {
    const seen = new Set();
    const curated = [];
    const custom = [];
    (options || []).forEach((raw) => {
      const v = String(raw || "").trim();
      const key = v.toLowerCase();
      if (v && !seen.has(key)) {
        seen.add(key);
        curated.push(v);
      }
    });
    (extra || []).forEach((raw) => {
      const v = String(raw || "").trim();
      const key = v.toLowerCase();
      if (v && !seen.has(key)) {
        seen.add(key);
        custom.push(v);
      }
    });
    custom.sort((a, b) => a.localeCompare(b));
    if (value && !seen.has(String(value).trim().toLowerCase())) {
      custom.unshift(String(value).trim());
    }
    return { curated, custom, all: [...curated, ...custom] };
  }, [options, extra, value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return merged.all;
    return merged.all.filter((x) => x.toLowerCase().includes(needle));
  }, [merged, query]);

  const exactMatch = useMemo(
    () =>
      merged.all.some((x) => x.toLowerCase() === query.trim().toLowerCase()),
    [merged, query],
  );
  const canCreate = query.trim().length > 0 && !exactMatch;
  const rowCount = filtered.length + (canCreate ? 1 : 0);

  const place = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  const openPanel = () => {
    place();
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = () => setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    const onClick = (e) => {
      if (
        panelRef.current?.contains(e.target) ||
        triggerRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
  };

  const createFromQuery = () => {
    const v = query.trim();
    if (!v) return;
    choose(v);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < filtered.length) choose(filtered[highlight]);
      else if (canCreate) createFromQuery();
    }
  };

  const isCustom = (v) =>
    !merged.curated.some((o) => o.toLowerCase() === v.toLowerCase());

  return (
    <div className={c.field}>
      {label && (
        <span className={c.label}>
          {label}
          {required && <em> *</em>}
        </span>
      )}
      <button
        type="button"
        ref={triggerRef}
        className={`${c.trigger} ${open ? c.triggerOpen : ""}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span className={value ? c.triggerValue : c.triggerPlaceholder}>
          {value || placeholder}
        </span>
        <svg
          className={c.chevron}
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          className={c.panel}
          style={(() => {
            const panelH = 320;
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < panelH && rect.top > spaceBelow;
            return {
              top: openUp
                ? Math.max(12, rect.top - 8 - panelH)
                : rect.bottom + 8,
              left: Math.min(
                Math.max(rect.left, 12),
                window.innerWidth - Math.max(rect.width, 260) - 12,
              ),
              width: Math.min(
                Math.max(rect.width, 260),
                window.innerWidth - 24,
              ),
              maxHeight: panelH,
            };
          })()}
        >
          <div className={c.searchRow}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              className={c.searchIcon}
            >
              <circle
                cx="9"
                cy="9"
                r="6.2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M14 14l4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search categories…"
            />
          </div>

          <div className={c.options} role="listbox">
            {filtered.length === 0 && !canCreate && (
              <div className={c.emptyState}>No matching categories</div>
            )}
            {filtered.map((opt, i) => (
              <button
                type="button"
                key={opt}
                role="option"
                aria-selected={opt === value}
                className={`${c.option} ${i === highlight ? c.optionHighlight : ""} ${opt === value ? c.optionSelected : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(opt)}
              >
                <span>{opt}</span>
                <span className={c.optionTags}>
                  {isCustom(opt) && <em className={c.customTag}>Custom</em>}
                  {opt === value && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M4 10.5l4 4 8-9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                className={`${c.option} ${c.createOption} ${filtered.length === highlight ? c.optionHighlight : ""}`}
                onMouseEnter={() => setHighlight(filtered.length)}
                onClick={createFromQuery}
              >
                <span className={c.createIcon}>＋</span>
                <span>Add “{query.trim()}” as a new category</span>
              </button>
            )}
          </div>
          <div className={c.panelFoot}>
            Not seeing it? Type a name above and add it as a new category.
          </div>
        </div>
      )}
    </div>
  );
}

export { CategorySelect };
