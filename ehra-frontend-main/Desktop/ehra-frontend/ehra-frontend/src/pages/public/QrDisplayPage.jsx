import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { getCurrentQrTokenPublic } from "../../api/attendanceApi";
import styles from "./QrDisplayPage.module.css";

/**
 * PUBLIC, unauthenticated page — reachable at /qr-display/:token with no
 * login required. This is the "share a link instead of admin access"
 * feature: an employer generates a display link from the Live QR tab
 * (QrDisplayLinkPanel.jsx) and can hand this exact URL to anyone — a
 * receptionist's tablet, a second device propped at the entrance — so
 * they can display the live rotating attendance QR without ever touching
 * the actual admin dashboard.
 *
 * Deliberately a near-duplicate of QrAttendancePanel.jsx's fetch/rotate
 * logic rather than a shared component: that panel is one card among many
 * on the authenticated dashboard, while this is a full, standalone,
 * kiosk-style screen meant to be glanced at from a few feet away (e.g.
 * propped up at a front desk) — different layout concerns entirely, and
 * this one calls the PUBLIC endpoint (token in the URL) instead of the
 * authenticated one (JWT + active business context).
 *
 * If the employer revokes the link, the next poll gets a 400 and this
 * shows a clear "this link no longer works" state — it does not keep
 * retrying forever, since a revoked link is a deliberate, permanent stop,
 * not a transient blip like a dropped network request.
 */
export default function QrDisplayPage() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  const [secondsLeft, setSecondsLeft] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revoked, setRevoked] = useState(false);
  const [transientError, setTransientError] = useState(false);

  const fetchAndRender = useCallback(async () => {
    try {
      const { data } = await getCurrentQrTokenPublic(token);
      setTransientError(false);

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, data.token, {
          width: 320,
          margin: 1,
          color: { dark: "#0F6E56", light: "#FFFFFF" },
        });
      }

      const seconds = Math.max(Math.round(data.expiresInMs / 1000), 1);
      setSecondsLeft(seconds);
      setTotalSeconds(seconds);

      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, data.expiresInMs);
    } catch (err) {
      // A revoked/unknown link comes back as a 4xx and will never start
      // working again on its own — the employer has to issue a new one.
      // Stop polling entirely instead of hammering the server forever.
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        setRevoked(true);
        return;
      }

      // Anything else (network blip, 5xx) is worth retrying.
      console.error("Failed to fetch QR token:", err);
      setTransientError(true);
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, 5000);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAndRender();
    return () => clearTimeout(refreshTimeoutRef.current);
  }, [fetchAndRender]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  if (revoked) {
    return (
      <div className={styles.page}>
        <div className={styles.revokedCard}>
          <i className="ti ti-link-off" aria-hidden="true" />
          <h1 className={styles.revokedTitle}>This link no longer works</h1>
          <p className={styles.revokedText}>
            Your employer may have revoked it or generated a new one. Ask them
            to share the current link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.liveDot} />
          <span className={styles.title}>Scan to clock in / out</span>
        </div>

        <div className={styles.qrWrap}>
          {transientError ? (
            <div className={styles.placeholderError}>
              <i className="ti ti-alert-circle" aria-hidden="true" />
              Couldn't load QR code — retrying…
            </div>
          ) : (
            <>
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
            Refreshes every {totalSeconds ?? "—"} seconds · Open your Ehra app
            camera to scan
          </p>
        </div>
      </div>
    </div>
  );
}
