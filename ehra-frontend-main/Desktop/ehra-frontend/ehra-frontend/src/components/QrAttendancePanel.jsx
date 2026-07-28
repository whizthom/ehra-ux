import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { getCurrentQrToken } from "../api/attendanceApi";
import styles from "./QrAttendancePanel.module.css";

/**
 * Renders a rotating QR code. Each render encodes a fresh, single-use
 * token issued by the backend (see QrSessionService) — so a screenshot of
 * the code is worthless once it expires. The rotation length itself is
 * whatever the backend says (QrSessionService.TOKEN_TTL_MS) — this
 * component doesn't hardcode a duration, it just re-fetches whenever the
 * server tells it the current token is about to expire, so the two can
 * never drift out of sync.
 */
export default function QrAttendancePanel() {
  const canvasRef = useRef(null);
  const refreshTimeoutRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
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

      const seconds = Math.max(Math.round(data.expiresInMs / 1000), 1);
      setSecondsLeft(seconds);
      setTotalSeconds(seconds);

      // Self-scheduling: ask again right around when this token expires,
      // whatever that duration is, instead of assuming a fixed interval.
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, data.expiresInMs);
    } catch (err) {
      console.error("Failed to fetch QR token:", err);
      setError(true);
      // Still retry even after a failure, otherwise the panel goes stale
      // forever on a transient network blip.
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, 5000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndRender();
    return () => clearTimeout(refreshTimeoutRef.current);
  }, [fetchAndRender]);

  // Visual countdown ring — purely cosmetic, ticks down independent of the fetch
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s && s > 0 ? s - 1 : 0));
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
        {error ? (
          <div className={styles.placeholderError}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            Couldn't load QR code
          </div>
        ) : (
          <>
            {/* Canvas stays mounted even while loading — QRCode.toCanvas
                needs a real element to draw onto during the very first
                fetch. Rendering it only after `loading` flips false meant
                canvasRef.current was still null when that first fetch
                resolved, so nothing ever got drawn until the next refresh
                cycle tried again (and by then the canvas existed). */}
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              style={{ display: loading ? "none" : "block" }}
            />
            {loading && <div className={styles.placeholder}>Loading…</div>}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.refreshBar}>
          <div
            className={styles.refreshFill}
            style={{
              width: `${totalSeconds ? ((secondsLeft ?? 0) / totalSeconds) * 100 : 0}%`,
            }}
          />
        </div>
        <p className={styles.hint}>
          Refreshes every {totalSeconds ?? "—"} seconds · Employees scan with
          their phone camera
        </p>
      </div>
    </div>
  );
}
