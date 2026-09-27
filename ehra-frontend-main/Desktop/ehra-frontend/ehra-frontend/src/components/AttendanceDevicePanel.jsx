import { useCallback, useEffect, useState } from "react";
import { readSession } from "../api/authApi";
import {
  getMyAttendanceDevice,
  revokeMyAttendanceDevice,
} from "../api/attendanceDeviceApi";
import {
  clearAttendanceDevice,
  getAttendanceDeviceContext,
} from "../utils/attendanceDeviceCrypto";
import styles from "./AttendanceDevicePanel.module.css";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function friendlyError(err, fallback) {
  return err?.response?.data?.message || fallback;
}

export default function AttendanceDevicePanel() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await getMyAttendanceDevice();
      setDevice(data || null);
    } catch (err) {
      setMessage({
        type: "error",
        text: friendlyError(err, "Couldn't load your attendance device."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async () => {
    if (
      !window.confirm(
        "Revoke your current attendance device? Ehral will stop trusting that device. You can use another device and it can be registered automatically during your next verified attendance.",
      )
    )
      return;
    setActionLoading(true);
    setMessage(null);
    try {
      await revokeMyAttendanceDevice();
      const session = readSession();
      await clearAttendanceDevice(getAttendanceDeviceContext(session));
      setDevice(null);
      setMessage({
        type: "success",
        text: "Your attendance device has been revoked. Register this device again when you are ready.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: friendlyError(err, "Couldn't revoke the attendance device."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className={styles.loading}>Loading your attendance device…</div>
    );

  return (
    <section className={styles.wrap}>
      {message && (
        <div
          className={`${styles.message} ${message.type === "error" ? styles.error : styles.success}`}
        >
          <i
            className={`ti ${message.type === "error" ? "ti-alert-circle" : "ti-circle-check"}`}
          />
          <span>{message.text}</span>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <i className="ti ti-device-mobile" />
          </div>
          <div>
            <h3>Attendance device</h3>
            <p>
              Ehral automatically registers a cryptographic device identity
              after successful verified attendance. Device names and IMEI values
              are not used as the trust mechanism.
            </p>
          </div>
        </div>

        {device ? (
          <>
            <div className={styles.deviceGrid}>
              <div>
                <span>Device</span>
                <strong>{device.deviceName || "This device"}</strong>
              </div>
              <div>
                <span>Platform</span>
                <strong>{device.platform || "Web"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  {device.bindingStatus || device.deviceStatus || "Active"}
                </strong>
              </div>
              <div>
                <span>Last seen</span>
                <strong>{formatDate(device.lastSeenAt)}</strong>
              </div>
            </div>
            <div className={styles.note}>
              <i className="ti ti-info-circle" />
              <span>
                You can use more than one device. New devices are added
                automatically after successful verified attendance, while your
                existing device remains registered.
              </span>
            </div>
            <button
              type="button"
              className={styles.revokeBtn}
              onClick={revoke}
              disabled={actionLoading}
            >
              {actionLoading ? "Revoking…" : "Revoke this device"}
            </button>
          </>
        ) : (
          <div className={styles.empty}>
            <i className="ti ti-device-mobile-off" />
            <div>
              <strong>No registered attendance device</strong>
              <p>
                Your device will be registered automatically after your first
                successful verified attendance. Opening the attendance screen
                alone does not register a device.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
