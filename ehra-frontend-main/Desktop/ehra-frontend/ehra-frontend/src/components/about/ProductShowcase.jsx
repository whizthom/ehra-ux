import DeviceFrame from "./DeviceFrame";
import DashboardPreview from "./DashboardPreview";
import MobileProductPreview from "./MobileProductPreview";
import styles from "./ProductShowcase.module.css";

function fullName(first, last) {
  return [first, last].filter(Boolean).join(" ") || "Team member";
}

function timeLabel(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * The hero's signature visual: the real Ehral desktop dashboard and the
 * real Ehral mobile attendance screen, composed together with depth —
 * so the very first thing a visitor sees is the actual product, not an
 * illustration of "a product like this".
 *
 * Renders its illustrative sample data by default. When a `liveData`
 * snapshot is passed in (see useLiveWorkspaceData) and the visitor is
 * actually signed in, the floating notification card reflects a real
 * check-in from their own workspace instead of the sample one.
 */
export default function ProductShowcase({ liveData }) {
  const realCheckIn =
    liveData?.live && liveData?.attendance
      ? liveData.attendance.find((r) => r.clockIn)
      : null;

  const floatName = realCheckIn
    ? fullName(realCheckIn.employeeFirstName, realCheckIn.employeeLastName)
    : "Amaka O.";
  const floatMeta = realCheckIn
    ? `${realCheckIn.department || "Your team"} · ${timeLabel(realCheckIn.clockIn) || "today"}`
    : "Engineering · 8:52 AM";

  return (
    <div className={styles.stage}>
      <div className={styles.desktopLayer}>
        <DeviceFrame variant="browser" label="app.ehral.com/dashboard">
          <DashboardPreview screen="overview" liveData={liveData} />
        </DeviceFrame>
      </div>

      <div className={styles.phoneLayer}>
        <MobileProductPreview screen="attendance" liveData={liveData} />
      </div>

      <div className={styles.floatCard} aria-hidden="true">
        <i className="ti ti-fingerprint" />
        <div>
          <strong>{floatName} checked in</strong>
          <span>{floatMeta}</span>
        </div>
      </div>
    </div>
  );
}
