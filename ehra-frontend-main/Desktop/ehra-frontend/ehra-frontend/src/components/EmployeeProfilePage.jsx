import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getEmployeeProfile, sendAnnouncement } from "../api/workforceApi";
import EmploymentTab from "../components/EmploymentTab";
import styles from "./EmployeeProfilePage.module.css";

const STATUS_COLOR = {
  ACTIVE: { bg: "#e1f5ee", color: "#085041" },
  PENDING_APPROVAL: { bg: "#faeeda", color: "#633806" },
  REJECTED: { bg: "#fcebeb", color: "#791f1f" },
  SUSPENDED: { bg: "#f1f5f9", color: "#475569" },
};

const ATTENDANCE_COLOR = {
  PRESENT: { bg: "#e1f5ee", color: "#085041" },
  LATE: { bg: "#faeeda", color: "#633806" },
  EARLY_LEAVE: { bg: "#e6f1fb", color: "#185fa5" },
  ABSENT: { bg: "#fcebeb", color: "#791f1f" },
};

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // When navigated from HodWorkforceTab, state.hodView=true — hide messaging.
  const hodView = location.state?.hodView === true;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getEmployeeProfile(id)
      .then(({ data }) => setProfile(data))
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendMessage = async () => {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setSending(true);
    try {
      await sendAnnouncement({
        subject: msgSubject,
        body: msgBody,
        recipientEmployeeId: Number(id),
      });
      setMsgOpen(false);
      setMsgSubject("");
      setMsgBody("");
      alert("Message sent successfully.");
    } catch {
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading employee profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.loadingWrap}>
        <p>Employee not found.</p>
        <button onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const statusStyle = STATUS_COLOR[profile.status] || STATUS_COLOR.ACTIVE;

  return (
    <div className={styles.page}>
      {/* ── Back button ── */}
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Back to workforce
      </button>

      {/* ── Hero section ── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.avatar}>
            {profile.profilePictureUrl ? (
              <img
                src={profile.profilePictureUrl}
                alt={name}
                className={styles.avatarImg}
              />
            ) : (
              <span className={styles.avatarInitials}>
                {initials(profile.firstName, profile.lastName)}
              </span>
            )}
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>{name}</h1>
              <span
                className={styles.statusBadge}
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {profile.status?.replace("_", " ")}
              </span>
            </div>
            <p className={styles.heroEmail}>{profile.email}</p>
            {profile.phone && (
              <p className={styles.heroPhone}>{profile.phone}</p>
            )}
            <div className={styles.heroBadges}>
              <span className={styles.roleBadge}>{profile.role}</span>
              <span className={styles.deptBadge}>
                <i
                  className="ti ti-building"
                  style={{ fontSize: 11 }}
                  aria-hidden="true"
                />
                {profile.departmentName || "Unassigned"}
              </span>
              {profile.hodName && (
                <span className={styles.hodBadge}>
                  <i
                    className="ti ti-user-star"
                    style={{ fontSize: 11 }}
                    aria-hidden="true"
                  />
                  HOD: {profile.hodName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.heroActions}>
          {!hodView && (
            <button className={styles.msgBtn} onClick={() => setMsgOpen(true)}>
              <i className="ti ti-send" aria-hidden="true" /> Send message
            </button>
          )}
          {profile.idCardUrl && (
            <a
              href={profile.idCardUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.idCardBtn}
            >
              <i className="ti ti-id-badge" aria-hidden="true" /> View ID card
            </a>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {[
          { key: "overview", label: "Overview" },
          { key: "attendance", label: "Attendance" },
          { key: "leave", label: "Leave" },
          { key: "employment", label: "Employment" },
          ...(!hodView ? [{ key: "announcements", label: "Messages" }] : []),
        ].map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>
        {/* Overview */}
        {tab === "overview" && (
          <div className={styles.overviewGrid}>
            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>Personal details</h3>
              <div className={styles.infoRows}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Full name</span>
                  <span className={styles.infoValue}>{name || "—"}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{profile.email}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Phone</span>
                  <span className={styles.infoValue}>
                    {profile.phone || "—"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Role</span>
                  <span className={styles.infoValue}>{profile.role}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}>
                    {profile.status?.replace("_", " ")}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Joined</span>
                  <span className={styles.infoValue}>
                    {profile.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>Department & HOD</h3>
              <div className={styles.infoRows}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Department</span>
                  <span className={styles.infoValue}>
                    {profile.departmentName || "Unassigned"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Head of dept</span>
                  <span className={styles.infoValue}>
                    {profile.hodName || "Not assigned"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>Identity documents</h3>
              {profile.idCardUrl ? (
                <div className={styles.idCardPreview}>
                  <a href={profile.idCardUrl} target="_blank" rel="noreferrer">
                    <div className={styles.idCardThumb}>
                      <i
                        className="ti ti-id-badge"
                        style={{ fontSize: 32, color: "#0f6e56" }}
                        aria-hidden="true"
                      />
                      <span>View ID card</span>
                    </div>
                  </a>
                </div>
              ) : (
                <p className={styles.noDoc}>No ID card uploaded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Attendance */}
        {tab === "attendance" && (
          <div className={styles.tableWrap}>
            {!profile.recentAttendance?.length ? (
              <p className={styles.emptyMsg}>No attendance records yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recentAttendance.map((a) => {
                    const st =
                      ATTENDANCE_COLOR[a.status] || ATTENDANCE_COLOR.PRESENT;
                    return (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{formatTime(a.clockIn)}</td>
                        <td>{formatTime(a.clockOut)}</td>
                        <td>
                          <span
                            className={styles.attPill}
                            style={{ background: st.bg, color: st.color }}
                          >
                            {a.status?.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Leave History */}
        {tab === "leave" && (
          <div className={styles.tableWrap}>
            {!profile.leaveHistory?.length ? (
              <p className={styles.emptyMsg}>
                No leave requests found for this employee.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Applied</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Admin note</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.leaveHistory.map((l) => {
                    const LEAVE_COLOR = {
                      PENDING: { bg: "#faeeda", color: "#633806" },
                      APPROVED: { bg: "#e1f5ee", color: "#085041" },
                      REJECTED: { bg: "#fcebeb", color: "#791f1f" },
                    };
                    const st = LEAVE_COLOR[l.status] || LEAVE_COLOR.PENDING;
                    return (
                      <tr key={l.id}>
                        <td>
                          {l.createdAt
                            ? new Date(l.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>{l.startDate}</td>
                        <td>{l.endDate}</td>
                        <td>{l.days}</td>
                        <td
                          style={{
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={l.reason}
                        >
                          {l.reason}
                        </td>
                        <td>
                          <span
                            className={styles.attPill}
                            style={{ background: st.bg, color: st.color }}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td style={{ color: "#6b7c77", fontSize: 12 }}>
                          {l.adminNote || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Employment type + part-time attendance schedule */}
        {tab === "employment" && <EmploymentTab employeeId={id} />}

        {/* Announcements/Messages — hidden in HOD view */}
        {tab === "announcements" && (
          <div className={styles.announcementList}>
            {!profile.recentAnnouncements?.length ? (
              <p className={styles.emptyMsg}>
                No messages sent to this employee yet.
              </p>
            ) : (
              profile.recentAnnouncements.map((a) => (
                <div key={a.id} className={styles.announcementItem}>
                  <div className={styles.announcementTop}>
                    <span className={styles.announcementSubject}>
                      {a.subject}
                    </span>
                    <div className={styles.announcementMeta}>
                      {a.broadcast && (
                        <span className={styles.broadcastTag}>Broadcast</span>
                      )}
                      <span
                        className={`${styles.readTag} ${a.readByMe ? styles.readTagRead : ""}`}
                      >
                        {a.readByMe ? "Read" : "Unread"}
                      </span>
                      <span className={styles.announcementTime}>
                        {a.createdAt
                          ? new Date(a.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  </div>
                  <p className={styles.announcementBody}>{a.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Send message modal (employer only — hidden in HOD view) ── */}
      {msgOpen && !hodView && (
        <div className={styles.modalOverlay} onClick={() => setMsgOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Send message to {profile.firstName}</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setMsgOpen(false)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Subject</label>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="e.g. Policy update"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Message</label>
                <textarea
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Write your message here…"
                  rows={5}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.cancelBtn}
                onClick={() => setMsgOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.sendBtn}
                onClick={handleSendMessage}
                disabled={sending || !msgSubject.trim() || !msgBody.trim()}
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
