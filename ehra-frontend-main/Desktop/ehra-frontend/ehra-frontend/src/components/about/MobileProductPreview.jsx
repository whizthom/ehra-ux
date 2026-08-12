import DeviceFrame from "./DeviceFrame";
import styles from "./MobileProductPreview.module.css";

// Fixed dot pattern (not random) so the "QR" doesn't reshuffle on every
// re-render — it just needs to read as QR-like at a glance, at this size.
const QR_PATTERN =
  "1101001" +
  "1011011" +
  "0110101" +
  "1101001" +
  "0011010" +
  "1010110" +
  "0101101";

const BOTTOM_NAV = [
  { icon: "ti-home", label: "Home" },
  { icon: "ti-fingerprint", label: "Attend" },
  { icon: "ti-calendar-off", label: "Leave" },
  { icon: "ti-message-circle", label: "Chat" },
  { icon: "ti-user", label: "You" },
];

function AttendanceScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.screenHeader}>Attendance</div>
      <div className={styles.qrCard}>
        <div className={styles.miniQr}>
          {QR_PATTERN.split("").map((bit, i) => (
            <span key={i} className={bit === "1" ? styles.qrOn : ""} />
          ))}
        </div>
        <span className={styles.qrCaption}>Scan to check in</span>
      </div>
      <div className={styles.listCard}>
        <div className={styles.listRow}>
          <i className="ti ti-circle-check" />
          <span>Checked in — 8:52 AM</span>
        </div>
        <div className={styles.listRow}>
          <i className="ti ti-map-pin" />
          <span>Location verified</span>
        </div>
      </div>
    </div>
  );
}

function LeaveScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.screenHeader}>Leave</div>
      <div className={styles.listCard}>
        <div className={styles.listRow}>
          <i className="ti ti-clock" />
          <span>Awaiting HOD review</span>
        </div>
        <div className={styles.listRow}>
          <i className="ti ti-circle-check" style={{ color: "#0f6e56" }} />
          <span>Cover person confirmed</span>
        </div>
      </div>
      <button className={styles.miniBtn} type="button" tabIndex={-1}>
        Request leave
      </button>
    </div>
  );
}

function ChatScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.screenHeader}>Messages</div>
      <div className={styles.bubbleReceived}>
        Shift starts 30 min early tomorrow.
      </div>
      <div className={styles.bubbleSent}>Got it, I&apos;ll be there.</div>
      <div className={styles.bubbleReceived}>👍</div>
    </div>
  );
}

function NotificationsScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.screenHeader}>Notifications</div>
      <div className={styles.listCard}>
        <div className={styles.listRow}>
          <i className="ti ti-bell" />
          <span>Leave approved</span>
        </div>
        <div className={styles.listRow}>
          <i className="ti ti-speakerphone" />
          <span>New announcement</span>
        </div>
        <div className={styles.listRow}>
          <i className="ti ti-user-plus" />
          <span>New hire onboarded</span>
        </div>
      </div>
    </div>
  );
}

const SCREENS = {
  attendance: AttendanceScreen,
  leave: LeaveScreen,
  chat: ChatScreen,
  notifications: NotificationsScreen,
};

/**
 * Phone-framed snapshot of the mobile employee experience. `screen`
 * chooses which real Ehral mobile surface it stands in for — these are
 * illustrative redraws in the app's own visual language, not the live
 * connected components, so the section can render instantly without an
 * authenticated session.
 */
export default function MobileProductPreview({
  screen = "attendance",
  className = "",
}) {
  const Screen = SCREENS[screen] || AttendanceScreen;
  return (
    <DeviceFrame variant="phone" className={className}>
      <div className={styles.wrap}>
        <Screen />
        <div className={styles.bottomNav}>
          {BOTTOM_NAV.map((item) => (
            <i
              key={item.label}
              className={`ti ${item.icon} ${
                item.label.toLowerCase().startsWith(screen.slice(0, 4))
                  ? styles.navActive
                  : styles.navIdle
              }`}
            />
          ))}
        </div>
      </div>
    </DeviceFrame>
  );
}
