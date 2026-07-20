import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { submitScan } from "../api/attendanceApi";
import styles from "./QrScanModal.module.css";

/**
 * Full-screen overlay scanner. Reuses the same decode loop as the original
 * standalone ScanAttendance page, but lives inside the employee dashboard
 * as a modal so the employee never has to leave their dashboard to clock
 * in or out.
 */
export default function QrScanModal({ onClose, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scanLockRef = useRef(false);

  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(true);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Best-effort — only businesses with Attendance Zone turned on actually
  // require this; everyone else's scan works exactly the same whether or
  // not location is available/granted. Short timeout so a slow/denied
  // location prompt never holds up an otherwise-valid scan.
  const getCoords = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000 },
      );
    });
  }, []);

  const handleDecoded = useCallback(
    async (token) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setScanning(false);
      stopCamera();

      try {
        const coords = await getCoords();
        const { data } = await submitScan(token, coords);
        setResult({
          ok: true,
          action: data.action,
          status: data.status,
          message: data.message,
        });
        onSuccess?.(data);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          "Scan failed. Please try again.";
        setResult({
          ok: false,
          message: typeof msg === "string" ? msg : "Scan failed.",
        });
      }
    },
    [stopCamera, onSuccess, getCoords],
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        handleDecoded(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Couldn't access your camera. Please allow camera permission and try again.",
      );
    }
  }, [tick]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleScanAgain = () => {
    scanLockRef.current = false;
    setResult(null);
    setScanning(true);
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    onClose?.();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Scan to clock in / out</span>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <p className={styles.subtitle}>
          Point your camera at the QR code on the admin's screen.
        </p>

        <div className={styles.scannerFrame}>
          {scanning && !cameraError && (
            <>
              <video
                ref={videoRef}
                className={styles.video}
                playsInline
                muted
              />
              <div className={styles.scanOverlay}>
                <div className={styles.scanBox} />
              </div>
            </>
          )}

          {cameraError && (
            <div className={styles.errorState}>
              <i
                className="ti ti-camera-off"
                style={{ fontSize: 32 }}
                aria-hidden="true"
              />
              <p>{cameraError}</p>
              <button className={styles.retryBtn} onClick={startCamera}>
                Try again
              </button>
            </div>
          )}

          {result && (
            <div
              className={`${styles.resultState} ${result.ok ? styles.resultOk : styles.resultFail}`}
            >
              <i
                className={`ti ${result.ok ? "ti-circle-check" : "ti-circle-x"}`}
                style={{ fontSize: 40 }}
                aria-hidden="true"
              />
              <p className={styles.resultMessage}>{result.message}</p>
              {result.ok && (
                <span className={styles.resultAction}>
                  {result.action === "CLOCK_IN" ? "Clocked in" : "Clocked out"}
                </span>
              )}
              <div className={styles.resultActions}>
                <button
                  className={styles.scanAgainBtn}
                  onClick={handleScanAgain}
                >
                  Scan again
                </button>
                <button className={styles.doneBtn} onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
