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
  // Camera is never started automatically — see startCamera() for why.
  // "idle" = not requested yet, "starting" = request in flight.
  const [cameraState, setCameraState] = useState("idle");

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

  const requestCamera = useCallback(async (constraints) => {
    return Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("camera-timeout")), 8000),
      ),
    ]);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraState("starting");

    if (!window.isSecureContext) {
      // getUserMedia is unavailable outside a secure context (HTTPS, or
      // localhost) on every browser — this isn't a permission problem,
      // no prompt will ever appear, so say so plainly rather than
      // showing the generic "allow camera permission" message.
      setCameraError(
        "Camera access requires a secure (https) connection. Please reload this page over https and try again.",
      );
      setCameraState("idle");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser doesn't support camera access. Please try a different or updated browser.",
      );
      setCameraState("idle");
      return;
    }

    try {
      let stream;
      try {
        // Preferred: rear camera.
        stream = await requestCamera({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (err) {
        // Rear-camera constraint couldn't be satisfied (no matching
        // camera — common on laptops/desktops with only a front camera,
        // or a device whose camera enumeration doesn't cleanly resolve
        // "environment"). Fall back to whatever camera is available
        // rather than failing outright. A genuine permission denial
        // (NotAllowedError) will fail this the same way it failed the
        // first attempt, so we still end up in the error state below.
        if (err?.name === "NotAllowedError") throw err;
        stream = await requestCamera({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState("running");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const message =
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access for this site in your browser settings, then try again."
          : err?.name === "NotFoundError"
            ? "No camera was found on this device."
            : "Couldn't access your camera. Please allow camera permission and try again.";
      setCameraError(message);
      setCameraState("idle");
    }
  }, [tick, requestCamera]);

  // No auto-start: getUserMedia is only ever called directly from a tap
  // (the "Enable camera" button below, or "Try again" on error). Every
  // browser — Chrome, Safari, Firefox, Samsung Internet — is most
  // permissive right when the request is tied to a real, direct user
  // gesture; deferring it to an effect on mount is exactly what made
  // some browsers (notably Samsung Internet) silently do nothing at all
  // instead of showing a permission prompt.
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
          {/* Always mounted — never conditionally rendered on cameraState.
              startCamera() assigns the stream to videoRef.current as soon
              as getUserMedia resolves, *before* cameraState flips to
              "running". If this element only existed once cameraState
              was already "running", videoRef.current would still be null
              at assignment time, the srcObject/play() call would silently
              no-op, and the <video> that finally mounted afterwards would
              have no stream attached — exactly the dark, blank
              .scannerFrame (background: #000) that was being reported.
              Visibility is handled with a CSS class instead. */}
          <video
            ref={videoRef}
            className={`${styles.video} ${
              scanning && cameraState === "running" && !cameraError
                ? ""
                : styles.videoHidden
            }`}
            playsInline
            muted
          />

          {scanning && cameraState === "running" && !cameraError && (
            <div className={styles.scanOverlay}>
              <div className={styles.scanBox} />
            </div>
          )}

          {cameraState === "idle" && !cameraError && scanning && (
            <div className={styles.errorState}>
              <i
                className="ti ti-camera"
                style={{ fontSize: 32 }}
                aria-hidden="true"
              />
              <p>Tap below to enable your camera and scan.</p>
              <button className={styles.retryBtn} onClick={startCamera}>
                Enable camera
              </button>
            </div>
          )}

          {cameraState === "starting" && !cameraError && (
            <div className={styles.errorState}>
              <p>Requesting camera access…</p>
            </div>
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
