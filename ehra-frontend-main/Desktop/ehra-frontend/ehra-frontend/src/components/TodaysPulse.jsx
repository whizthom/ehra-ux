import styles from "./TodaysPulse.module.css";

/**
 * Mobile-only "hero" widget for the top of the employer dashboard — a
 * circular gauge summarizing today's attendance at a glance, all values
 * derived from real dashboard-summary + today's-attendance data (see
 * Dashboard.jsx), not placeholders.
 */
export default function TodaysPulse({
  totalStaff,
  clockedIn,
  onTime,
  late,
  absent,
  percent,
  lastClockInLabel,
}) {
  const R = 74;
  const STROKE = 14;
  const circumference = 2 * Math.PI * R;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = circumference * (1 - clampedPercent / 100);

  return (
    <div className={styles.card}>
      <div className={styles.title}>Today's Pulse</div>

      <div className={styles.ringWrap}>
        <svg viewBox="0 0 200 200" className={styles.ringSvg}>
          <circle cx="100" cy="100" r="92" className={styles.ticks} />
          <circle
            cx="100"
            cy="100"
            r={R}
            className={styles.track}
            strokeWidth={STROKE}
          />
          <circle
            cx="100"
            cy="100"
            r={R}
            className={styles.progress}
            strokeWidth={STROKE}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={styles.ringCenter}>
          <div className={styles.ringNum}>{clockedIn}</div>
          <div className={styles.ringOf}>of {totalStaff} staff</div>
          <div className={styles.ringPct}>{clampedPercent}% clocked in</div>
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotOnTime}`} />
          On time <b>{onTime}</b>
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotLate}`} />
          Late <b>{late}</b>
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotAbsent}`} />
          Absent <b>{absent}</b>
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.lastClockIn}>{lastClockInLabel}</span>
        <span className={styles.live}>
          <span className={styles.liveDot} />
          live
        </span>
      </div>
    </div>
  );
}
