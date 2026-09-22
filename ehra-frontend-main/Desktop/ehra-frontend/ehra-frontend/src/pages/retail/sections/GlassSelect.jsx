import { useEffect, useMemo, useRef, useState } from "react";
import c from "./GlassSelect.module.css";

// Small set of built-in monochrome glyphs so common payment methods get a
// carved icon instead of plain text. Anything not in this map just shows
// text — options can also pass their own `icon` key to reuse these, or
// omit it entirely.
const ICONS = {
  cash: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect
        x="2"
        y="5.5"
        width="16"
        height="9"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.3 5.5v9M15.7 5.5v9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect
        x="2"
        y="4.3"
        width="16"
        height="11.4"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M2 8.1h16" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.5 12.2h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.2 18 6.8H2L10 2.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M3.4 8.2v7M7.3 8.2v7M12.7 8.2v7M16.6 8.2v7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M2 17.3h16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  dot: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6.7 10.2l2.1 2.1 4.4-4.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M10 6v4.3l2.8 1.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.3 7.3l5.4 5.4M12.7 7.3l-5.4 5.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// A premium replacement for the native <select> popup. Rather than a
// floating glassmorphism card, the panel reads as a continuation of the
// same frosted-white slab the trigger sits on — options are inset/etched
// into the material instead of raised chips on a blurred backdrop.
function GlassSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const norm = useMemo(
    () =>
      (options || []).map((o) =>
        typeof o === "string" ? { value: o, label: o } : o,
      ),
    [options],
  );

  const selected = norm.find((o) => o.value === value);

  const place = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  const openPanel = () => {
    place();
    setHighlight(
      Math.max(
        0,
        norm.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    place();
    const reposition = () => place();
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
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
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const choose = (v) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, norm.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (norm[highlight]) choose(norm[highlight].value);
    }
  };

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
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={c.triggerLeft}>
          {selected?.icon && (
            <span className={c.optionIcon}>{ICONS[selected.icon]}</span>
          )}
          <span className={value ? c.triggerValue : c.triggerPlaceholder}>
            {selected?.label || placeholder}
          </span>
        </span>
        <svg
          className={c.chevron}
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          className={c.panel}
          role="listbox"
          style={(() => {
            const panelH = Math.min(280, 52 + norm.length * 40);
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < panelH && rect.top > spaceBelow;
            return {
              top: openUp ? undefined : rect.bottom - 1,
              bottom: openUp ? window.innerHeight - rect.top - 1 : undefined,
              left: Math.min(
                Math.max(rect.left, 12),
                window.innerWidth - Math.max(rect.width, 220) - 12,
              ),
              width: Math.max(rect.width, 220),
              maxHeight: panelH,
            };
          })()}
        >
          {norm.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${c.option} ${i === highlight ? c.optionHighlight : ""} ${opt.value === value ? c.optionSelected : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(opt.value)}
            >
              <span className={c.optionLeft}>
                {opt.icon && (
                  <span className={c.optionIcon}>{ICONS[opt.icon]}</span>
                )}
                <span>{opt.label}</span>
              </span>
              {opt.value === value && (
                <span className={c.optionTick}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4 10.5l4 4 8-9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { GlassSelect };
