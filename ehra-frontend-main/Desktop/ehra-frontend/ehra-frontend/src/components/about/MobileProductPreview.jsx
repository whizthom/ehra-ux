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

function titleCase(str) {
  return (str || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function LiveBadge() {
  return (
    <span className={styles.liveBadge}>
      <span className={styles.liveDot} aria-hidden="true" />
      Live
    </span>
  );
}

function AttendanceScreen({ liveData, isLive }) {
  const isEmployer = liveData?.isEmployer;
  const attendance = liveData?.attendance;
  const mine = !isEmployer && attendance?.length ? attendance[0] : null;

  let statusLine = "Checked in — 8:52 AM";
  let subLine = "Location verified";
  let caption = "Scan to check in";

  if (isLive) {
    if (mine) {
      statusLine = mine.clockIn
        ? `Checked in — ${timeLabel(mine.clockIn) || "today"}`
        : mine.status === "ABSENT"
          ? "Not checked in today"
          : "Not yet checked in";
      subLine = mine.clockOut
        ? `Clocked out — ${timeLabel(mine.clockOut) || ""}`
        : "Your real status, today";
      caption = "Your live status";
    } else if (isEmployer && attendance) {
      const clockedIn = attendance.filter((r) => r.clockIn).length;
      statusLine = `${clockedIn} of ${attendance.length} checked in`;
      subLine = "Business-wide, today";
      caption = "Your team, live";
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.screenHeaderRow}>
        <div className={styles.screenHeader}>Attendance</div>
        {isLive && <LiveBadge />}
      </div>
      <div className={styles.qrCard}>
        <div className={styles.miniQr}>
          {QR_PATTERN.split("").map((bit, i) => (
            <span key={i} className={bit === "1" ? styles.qrOn : ""} />
          ))}
        </div>
        <span className={styles.qrCaption}>{caption}</span>
      </div>
      <div className={styles.listCard}>
        <div className={styles.listRow}>
          <i className="ti ti-circle-check" />
          <span>{statusLine}</span>
        </div>
        <div className={styles.listRow}>
          <i className="ti ti-map-pin" />
          <span>{subLine}</span>
        </div>
      </div>
    </div>
  );
}

function LeaveScreen({ liveData, isLive }) {
  const isEmployer = liveData?.isEmployer;
  const leaves = liveData?.leaves;

  let rows = [
    { icon: "ti-clock", text: "Awaiting HOD review" },
    { icon: "ti-circle-check", text: "Cover person confirmed", accent: true },
  ];

  if (isLive) {
    rows = leaves.length
      ? leaves.slice(0, 2).map((l) => ({
          icon: "ti-calendar-off",
          text: isEmployer
            ? `${fullName(l.employeeFirstName, l.employeeLastName)} · ${titleCase(l.status)}`
            : `${titleCase(l.leaveType) || "Leave"} · ${titleCase(l.status)}`,
          accent: l.status === "APPROVED",
        }))
      : [
          {
            icon: "ti-circle-check",
            text: isEmployer ? "No pending requests" : "No leave on record",
            accent: true,
          },
        ];
  }

  return (
    <div className={styles.screen}>
      <div className={styles.screenHeaderRow}>
        <div className={styles.screenHeader}>Leave</div>
        {isLive && <LiveBadge />}
      </div>
      <div className={styles.listCard}>
        {rows.map((r, i) => (
          <div className={styles.listRow} key={i}>
            <i
              className={`ti ${r.icon}`}
              style={r.accent ? { color: "#0f6e56" } : undefined}
            />
            <span>{r.text}</span>
          </div>
        ))}
      </div>
      <button className={styles.miniBtn} type="button" tabIndex={-1}>
        Request leave
      </button>
    </div>
  );
}

function ChatScreen({ liveData, isLive }) {
  const contacts = liveData?.contacts;
  const thread = liveData?.thread;

  if (isLive && thread?.length) {
    return (
      <div className={styles.screen}>
        <div className={styles.screenHeaderRow}>
          <div className={styles.screenHeader}>
            {contacts?.[0]?.name || "Messages"}
          </div>
          <LiveBadge />
        </div>
        {thread.slice(-3).map((m, i) => (
          <div
            key={i}
            className={m.fromMe ? styles.bubbleSent : styles.bubbleReceived}
          >
            {m.body}
          </div>
        ))}
      </div>
    );
  }

  if (isLive && contacts?.length) {
    return (
      <div className={styles.screen}>
        <div className={styles.screenHeaderRow}>
          <div className={styles.screenHeader}>Messages</div>
          <LiveBadge />
        </div>
        <div className={styles.listCard}>
          {contacts.slice(0, 3).map((c) => (
            <div className={styles.listRow} key={c.withKey}>
              <i className="ti ti-message-circle" />
              <span>
                {c.name}
                {c.unreadCount ? ` · ${c.unreadCount} unread` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

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

function NotificationsScreen({ liveData, isLive }) {
  const announcements = liveData?.announcements;

  let items = [
    { icon: "ti-bell", text: "Leave approved" },
    { icon: "ti-speakerphone", text: "New announcement" },
    { icon: "ti-user-plus", text: "New hire onboarded" },
  ];

  if (isLive) {
    items = announcements.length
      ? announcements.slice(0, 3).map((a) => ({
          icon: a.broadcast ? "ti-speakerphone" : "ti-bell",
          text: a.subject || "Announcement",
        }))
      : [{ icon: "ti-bell-off", text: "No announcements yet" }];
  }

  return (
    <div className={styles.screen}>
      <div className={styles.screenHeaderRow}>
        <div className={styles.screenHeader}>Notifications</div>
        {isLive && <LiveBadge />}
      </div>
      <div className={styles.listCard}>
        {items.map((it, i) => (
          <div className={styles.listRow} key={i}>
            <i className={`ti ${it.icon}`} />
            <span>{it.text}</span>
          </div>
        ))}
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

// Whether a given screen actually has enough real data to render live —
// checked per-screen (rather than just liveData.live) so, e.g., a
// visitor whose announcements call failed still gets a real attendance
// screen instead of the whole preview silently reverting to mock.
function computeIsLive(screen, liveData) {
  if (!liveData?.live) return false;
  switch (screen) {
    case "attendance":
      return Boolean(liveData.attendance);
    case "leave":
      return Boolean(liveData.leaves);
    case "chat":
      return Boolean(liveData.thread?.length || liveData.contacts?.length);
    case "notifications":
      return Boolean(liveData.announcements);
    default:
      return false;
  }
}

/**
 * Phone-framed snapshot of the mobile experience. `screen` chooses
 * which real Ehral mobile surface it stands in for.
 *
 * Renders its static illustrative mock by default — no auth/network
 * dependency. When a `liveData` snapshot is passed in (see
 * useLiveWorkspaceData) AND it has real data for this particular
 * screen, it renders that instead and shows a small "Live" badge.
 */
export default function MobileProductPreview({
  screen = "attendance",
  liveData,
  className = "",
}) {
  const Screen = SCREENS[screen] || AttendanceScreen;
  const isLive = computeIsLive(screen, liveData);

  return (
    <DeviceFrame variant="phone" className={className}>
      <div className={styles.wrap}>
        <Screen liveData={liveData} isLive={isLive} />
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
