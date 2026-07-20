import { useState, useRef, useEffect } from "react";
import styles from "./ReportsTab.module.css";

function iso(d) {
  return d.toISOString().slice(0, 10);
}
function fromIso(s) {
  return new Date(s + "T00:00:00");
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function startOfDisplayMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function fmtShort(iso_) {
  return fromIso(iso_).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Days to render for a given displayed month, padded to full weeks
// (Sunday-start), so the grid is always a clean 7-column rectangle.
function buildMonthGrid(monthStart) {
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * A self-contained popover calendar standing in for two native
 * <input type="date"> fields. Click a day to start the range, click a
 * later day to complete it (clicking an earlier day just restarts the
 * range from there) — then confirm with Apply. Nothing commits to the
 * parent's from/to state until Apply is pressed, so Cancel is a true
 * no-op.
 */
export default function ReportDateRangePicker({ from, to, onApply }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfDisplayMonth(fromIso(from)),
  );
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [pickingEnd, setPickingEnd] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    setPickingEnd(false);
    setViewMonth(startOfDisplayMonth(fromIso(from)));
  }, [open, from, to]);

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

  const handleDayClick = (day) => {
    const clicked = iso(day);
    if (!pickingEnd) {
      setDraftFrom(clicked);
      setDraftTo(clicked);
      setPickingEnd(true);
      return;
    }
    if (clicked < draftFrom) {
      setDraftFrom(clicked);
      setDraftTo(clicked);
    } else {
      setDraftTo(clicked);
      setPickingEnd(false);
    }
  };

  const grid = buildMonthGrid(viewMonth);
  const today = new Date();
  const draftFromDate = fromIso(draftFrom);
  const draftToDate = fromIso(draftTo);

  return (
    <div className={styles.dateRangeWrap} ref={ref}>
      <button
        type="button"
        className={styles.dateRangeTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <i className="ti ti-calendar" aria-hidden="true" />
        <span>
          {fmtShort(from)} – {fmtShort(to)}
        </span>
        <i
          className={`ti ti-chevron-down ${styles.dateRangeChevron} ${
            open ? styles.dateRangeChevronOpen : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.dateRangePanel} role="dialog">
          <div className={styles.dateRangeHint}>
            {pickingEnd ? "Now pick an end date" : "Pick a start date"}
          </div>

          <div className={styles.calMonthNav}>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            <span className={styles.calMonthLabel}>
              {monthLabel(viewMonth)}
            </span>
            <button
              type="button"
              className={styles.calNavBtn}
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>

          <div className={styles.calWeekdays}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className={styles.calGrid}>
            {grid.map((day, i) => {
              if (!day) return <span key={i} className={styles.calCellBlank} />;
              const inRange = day >= draftFromDate && day <= draftToDate;
              const isStart = sameDay(day, draftFromDate);
              const isEnd = sameDay(day, draftToDate);
              const isToday = sameDay(day, today);
              const isFuture = day > today;
              return (
                <button
                  type="button"
                  key={i}
                  disabled={isFuture}
                  className={[
                    styles.calCell,
                    inRange ? styles.calCellInRange : "",
                    isStart ? styles.calCellStart : "",
                    isEnd ? styles.calCellEnd : "",
                    isToday ? styles.calCellToday : "",
                  ].join(" ")}
                  onClick={() => handleDayClick(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className={styles.dateRangeFooter}>
            <button
              type="button"
              className={styles.dateRangeCancelBtn}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dateRangeApplyBtn}
              onClick={() => {
                onApply(draftFrom, draftTo);
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
