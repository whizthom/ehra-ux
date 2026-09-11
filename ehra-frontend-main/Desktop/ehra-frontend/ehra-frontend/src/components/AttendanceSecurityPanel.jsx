import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAttendanceSecurityEvents,
  getBusinessAttendanceDevices,
  resolveAttendanceSecurityEvent,
  revokeBusinessAttendanceDevice,
} from "../api/attendanceDeviceApi";
import styles from "./AttendanceSecurityPanel.module.css";

const EVENT_LABELS = {
  UNRECOGNIZED_DEVICE: "Unrecognized device",
  REVOKED_DEVICE: "Revoked device",
  MULTIPLE_EMPLOYEES_SAME_DEVICE: "Multiple employees / same device",
  SUSPICIOUS_ATTENDANCE: "Suspicious attendance",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function errorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

export default function AttendanceSecurityPanel() {
  const [tab, setTab] = useState("devices");
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deviceResponse, eventResponse] = await Promise.all([
        getBusinessAttendanceDevices(),
        getAttendanceSecurityEvents(),
      ]);
      setDevices(deviceResponse.data || []);
      setEvents(eventResponse.data || []);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load attendance security data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEvents = useMemo(
    () => events.filter((event) => event.status === "OPEN" || event.status === "UNDER_REVIEW"),
    [events],
  );

  const revoke = async (device) => {
    if (!window.confirm(`Revoke the attendance device registered to ${device.employeeName || "this employee"}? They will need to register a new device before device verification can be used again.`)) return;
    setBusyId(`revoke-${device.employeeId}`);
    setError("");
    try {
      await revokeBusinessAttendanceDevice(device.employeeId);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Couldn't revoke this attendance device."));
    } finally {
      setBusyId(null);
    }
  };

  const openEvent = (event) => {
    setSelectedEvent(event);
    setResolutionNote(event.resolutionNote || "");
  };

  const resolve = async () => {
    if (!selectedEvent) return;
    setBusyId(`resolve-${selectedEvent.id}`);
    setError("");
    try {
      const { data } = await resolveAttendanceSecurityEvent(selectedEvent.id, resolutionNote.trim());
      setEvents((current) => current.map((item) => item.id === data.id ? data : item));
      setSelectedEvent(data);
    } catch (err) {
      setError(errorMessage(err, "Couldn't resolve this security event."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <div>
          <h2>Attendance security</h2>
          <p>Manage registered attendance devices and review device-related attendance events for this business.</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <i className="ti ti-refresh" /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className={styles.error}><i className="ti ti-alert-circle" /><span>{error}</span></div>}

      <div className={styles.tabs}>
        <button className={tab === "devices" ? styles.active : ""} onClick={() => setTab("devices")}>Devices <span>{devices.length}</span></button>
        <button className={tab === "events" ? styles.active : ""} onClick={() => setTab("events")}>Security events <span>{openEvents.length}</span></button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading attendance security…</div>
      ) : tab === "devices" ? (
        <div className={styles.card}>
          {devices.length === 0 ? (
            <div className={styles.empty}><i className="ti ti-device-mobile-off" /><strong>No registered attendance devices</strong><span>Employees are registered when they open the attendance clock-in screen.</span></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Employee</th><th>Device</th><th>Platform</th><th>Status</th><th>Last seen</th><th /></tr></thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={`${device.employeeId}-${device.deviceId}`}>
                      <td><strong>{device.employeeName || "—"}</strong></td>
                      <td>{device.deviceName || "This device"}</td>
                      <td>{device.platform || "web"}</td>
                      <td><span className={`${styles.status} ${device.bindingStatus === "ACTIVE" && device.deviceStatus === "ACTIVE" ? styles.good : styles.warn}`}>{device.bindingStatus || device.deviceStatus || "—"}</span></td>
                      <td>{formatDate(device.lastSeenAt)}</td>
                      <td><button className={styles.revokeBtn} disabled={busyId === `revoke-${device.employeeId}`} onClick={() => revoke(device)}>{busyId === `revoke-${device.employeeId}` ? "Revoking…" : "Revoke"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.card}>
          {events.length === 0 ? (
            <div className={styles.empty}><i className="ti ti-shield-check" /><strong>No attendance security events</strong><span>Device-related events for this business will appear here when the backend records them.</span></div>
          ) : (
            <div className={styles.eventList}>
              {events.map((event) => (
                <button type="button" className={styles.event} key={event.id} onClick={() => openEvent(event)}>
                  <div className={`${styles.risk} ${event.riskLevel === "MEDIUM" ? styles.medium : styles.high}`}>{event.riskLevel || "—"}</div>
                  <div className={styles.eventMain}>
                    <strong>{event.employeeName || "Employee"}</strong>
                    <span>{EVENT_LABELS[event.eventType] || event.eventType || "Attendance event"}</span>
                    <small>{formatDate(event.createdAt)}</small>
                  </div>
                  <div className={`${styles.eventStatus} ${event.status === "RESOLVED" ? styles.resolved : ""}`}>{event.status}</div>
                  <i className="ti ti-chevron-right" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedEvent(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}><div><span className={`${styles.risk} ${selectedEvent.riskLevel === "MEDIUM" ? styles.medium : styles.high}`}>{selectedEvent.riskLevel}</span><h3>Attendance event</h3></div><button onClick={() => setSelectedEvent(null)} aria-label="Close"><i className="ti ti-x" /></button></div>
            <div className={styles.detailGrid}>
              <div><span>Employee</span><strong>{selectedEvent.employeeName || "—"}</strong></div>
              <div><span>Event</span><strong>{EVENT_LABELS[selectedEvent.eventType] || selectedEvent.eventType || "—"}</strong></div>
              <div><span>Action</span><strong>{selectedEvent.action || "—"}</strong></div>
              <div><span>Time</span><strong>{formatDate(selectedEvent.createdAt)}</strong></div>
              <div><span>Status</span><strong>{selectedEvent.status || "—"}</strong></div>
              <div><span>Device</span><strong>{selectedEvent.deviceId || "No device proof"}</strong></div>
            </div>
            <p className={styles.guidance}>Attendance was recorded and flagged for review. This event does not by itself establish fraud.</p>
            {selectedEvent.description && <div className={styles.description}>{selectedEvent.description}</div>}
            {selectedEvent.status !== "RESOLVED" && selectedEvent.status !== "DISMISSED" && (
              <>
                <label className={styles.noteLabel}>Resolution note <span>optional</span></label>
                <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="e.g. Employee replaced a damaged phone." rows={3} />
                <div className={styles.modalActions}><button className={styles.cancelBtn} onClick={() => setSelectedEvent(null)}>Close</button><button className={styles.resolveBtn} disabled={busyId === `resolve-${selectedEvent.id}`} onClick={resolve}>{busyId === `resolve-${selectedEvent.id}` ? "Resolving…" : "Resolve event"}</button></div>
              </>
            )}
            {(selectedEvent.status === "RESOLVED" || selectedEvent.status === "DISMISSED") && <div className={styles.resolutionBox}><strong>Resolution</strong><span>{selectedEvent.resolutionNote || "No resolution note was added."}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
