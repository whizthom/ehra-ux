import styles from "./QRCodeAttendanceDemo.module.css";

// Fixed pattern, animated in CSS via staggered per-cell opacity — reads as
// "a QR code that refreshes" without actually encoding anything.
const CELLS = Array.from({ length: 64 }, (_, i) => {
  const n = (i * 37 + 11) % 100;
  return n > 46;
});

const STATS = [
  { value: "< 3 sec", label: "Average check-in time" },
  { value: "100%", label: "Digital, no paper trail" },
  { value: "Optional", label: "GPS location verification" },
];

const STEPS = [
  {
    icon: "ti-device-tv",
    label: "Business displays QR",
    sub: "Refreshes periodically",
  },
  { icon: "ti-scan", label: "Employee scans", sub: "From their own phone" },
  {
    icon: "ti-map-pin-check",
    label: "Location checked",
    sub: "If enabled by the business",
  },
  {
    icon: "ti-circle-check",
    label: "Attendance recorded",
    sub: "Instantly, no paper",
  },
];

/**
 * The flagship visual for "Attendance without the attendance book" —
 * an animated rotating QR panel paired with the actual check-in
 * sequence. Self-contained: doesn't depend on WorkflowDiagram, since
 * this one needs its own countdown-ring/scan-pulse choreography.
 */
export default function QRCodeAttendanceDemo() {
  return (
    <div className={styles.wrap}>
      <div className={styles.qrPanel}>
        <div className={styles.ring}>
          <div className={styles.qrBox}>
            <div className={styles.qrGrid}>
              {CELLS.map((on, i) => (
                <span
                  key={i}
                  className={on ? styles.cellOn : styles.cellOff}
                  style={{ animationDelay: `${(i % 9) * 0.12}s` }}
                />
              ))}
            </div>
          </div>
        </div>
        <span className={styles.qrCaption}>
          <i className="ti ti-refresh" /> Refreshes automatically
        </span>
      </div>

      <div className={styles.flow}>
        {STEPS.map((step, i) => (
          <div className={styles.flowStep} key={step.label}>
            <span className={styles.flowDot}>
              <i className={`ti ${step.icon}`} />
            </span>
            <div className={styles.flowText}>
              <strong>{step.label}</strong>
              <span>{step.sub}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={styles.flowLine} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className={styles.statsRow}>
        {STATS.map((stat) => (
          <div className={styles.statCell} key={stat.label}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
