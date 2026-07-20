import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { getCurrentQrToken } from "../api/attendanceApi";
import styles from "./QrAttendancePanel.module.css";

/**
 * Renders a QR code that rotates every 5 seconds. Each render encodes a
 * fresh, single-use token issued by the backend (see QrSessionService) —
 * so a screenshot of the code is worthless after ~5 seconds.
 */
export default function QrAttendancePanel() {
  const canvasRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAndRender = useCallback(async () => {
    try {
      const { data } = await getCurrentQrToken();
      setError(false);

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, data.token, {
          width: 220,
          margin: 1,
          color: { dark: "#0F6E56", light: "#FFFFFF" },
        });
      }
      setSecondsLeft(Math.round(data.expiresInMs / 1000));
    } catch (err) {
      console.error("Failed to fetch QR token:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndRender();
    const refreshTimer = setInterval(fetchAndRender, 5000);
    return () => clearInterval(refreshTimer);
  }, [fetchAndRender]);

  // Visual countdown ring — purely cosmetic, ticks down independent of the fetch
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Attendance QR code</span>
        <span className={styles.liveDot} />
      </div>

      <div className={styles.qrWrap}>
        {loading ? (
          <div className={styles.placeholder}>Loading…</div>
        ) : error ? (
          <div className={styles.placeholderError}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            Couldn't load QR code
          </div>
        ) : (
          <canvas ref={canvasRef} className={styles.canvas} />
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.refreshBar}>
          <div
            className={styles.refreshFill}
            style={{ width: `${(secondsLeft / 5) * 100}%` }}
          />
        </div>
        <p className={styles.hint}>
          Refreshes every 5 seconds · Employees scan with their phone camera
        </p>
      </div>
    </div>
  );
}
