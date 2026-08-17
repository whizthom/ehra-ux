import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  getBranchAttendanceQr,
  regenerateBranchAttendanceQr,
} from "../api/branchApi";
import styles from "./BranchQrPanel.module.css";

/**
 * Same rotating-QR model as QrAttendancePanel, scoped to one branch. A
 * screenshot of this code only ever authenticates attendance for THIS
 * branch — an employee assigned to a different branch who scans it gets
 * rejected server-side (see AttendanceServiceImpl#processEmployeeScan).
 */
export default function BranchQrPanel({ branchId, branchStatus }) {
  const canvasRef = useRef(null);
  const refreshTimeoutRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [totalSeconds, setTotalSeconds] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const isInactive = branchStatus === "INACTIVE";

  const renderToken = useCallback((data) => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.token, {
        width: 200,
        margin: 1,
        color: { dark: "#0F6E56", light: "#FFFFFF" },
      }).catch(() => {});
    }
    const seconds = Math.max(Math.round(data.expiresInMs / 1000), 1);
    setSecondsLeft(seconds);
    setTotalSeconds(seconds);
  }, []);

  const fetchAndRender = useCallback(async () => {
    if (isInactive) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getBranchAttendanceQr(branchId);
      setError(null);
      renderToken(data);

      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, data.expiresInMs);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Couldn't load this branch's QR code.",
      );
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, 5000);
    } finally {
      setLoading(false);
    }
  }, [branchId, isInactive, renderToken]);

  useEffect(() => {
    fetchAndRender();
    return () => clearTimeout(refreshTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await regenerateBranchAttendanceQr(branchId);
      setError(null);
      renderToken(data);
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchAndRender, data.expiresInMs);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't regenerate this branch's QR code.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  if (isInactive) {
    return (
      <div className={styles.panel}>
        <div className={styles.inactiveState}>
          <i className="ti ti-qrcode-off" aria-hidden="true" />
          <h4>This branch is inactive</h4>
          <p>Reactivate it to generate an attendance QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <i className="ti ti-qrcode" aria-hidden="true" /> Branch attendance QR
        </span>
        <span className={styles.liveDot} />
      </div>

      <div className={styles.qrWrap}>
        {error ? (
          <div className={styles.placeholderError}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {error}
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
          Only employees assigned to this branch can clock in with it. Refreshes
          every {totalSeconds ?? "—"}s.
        </p>
        <button
          type="button"
          className={styles.regenBtn}
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating && <span className={styles.btnSpinner} />}
          <i className="ti ti-refresh" aria-hidden="true" />
          {regenerating ? "Regenerating…" : "Regenerate now"}
        </button>
      </div>
    </div>
  );
}
