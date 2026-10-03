import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  getAttendanceSettings,
  updateAttendanceSettings,
  regenerateStaticQr,
} from "../api/attendanceSettingsApi";
import { getMyBusinessProfile } from "../api/businessApi";
import styles from "./AttendanceSettingsPanel.module.css";
import { canSkipFetch, peekCache, putCache } from "../utils/viewCache";

const RADIUS_OPTIONS = [30, 50, 100, 200];

const SETTINGS_CACHE_KEY = "attendance:settings:business";

// Maps the settings response onto the panel's fields (used for both the
// cached first paint and, field by field, the live load below).
function settingsToState(settings, biz) {
  return {
    method: settings.attendanceMethod || "DYNAMIC_QR",
    zoneEnabled: !!settings.attendanceZoneEnabled,
    lat: settings.attendanceLatitude ?? null,
    lng: settings.attendanceLongitude ?? null,
    radius: settings.attendanceRadiusMeters || 50,
    offlineEnabled: settings.offlineAttendanceEnabled ?? true,
    offlineAllowClockIn: settings.offlineAllowClockIn ?? true,
    offlineAllowClockOut: settings.offlineAllowClockOut ?? true,
    business: biz,
  };
}

export default function AttendanceSettingsPanel() {
  // Paint from the in-memory view cache when we have a copy of these
  // settings that nothing has been saved since (utils/viewCache.js).
  // Never for a Static-QR setup: that token must always come from the
  // server, so a regenerated code can't be shown stale. load() below still
  // runs on every mount; Save stays disabled until it has finished.
  const [seed] = useState(() => {
    if (!canSkipFetch([SETTINGS_CACHE_KEY], Infinity)) return null;
    const hit = peekCache(SETTINGS_CACHE_KEY);
    return hit && hit.settings?.attendanceMethod !== "STATIC_QR" ? hit : null;
  });
  const init = seed ? settingsToState(seed.settings, seed.biz) : null;
  const seededRef = useRef(init !== null);
  const [loading, setLoading] = useState(init === null);
  const [revalidating, setRevalidating] = useState(init !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null); // { type: "ok"|"error", text }

  // Working copy of settings - only written back to the server on Save,
  // so switching cards/toggles around never partially-saves anything.
  const [method, setMethod] = useState(init ? init.method : "DYNAMIC_QR");
  const [staticToken, setStaticToken] = useState(null);
  const [zoneEnabled, setZoneEnabled] = useState(init ? init.zoneEnabled : false);
  const [lat, setLat] = useState(init ? init.lat : null);
  const [lng, setLng] = useState(init ? init.lng : null);
  const [radius, setRadius] = useState(init ? init.radius : 50);
  const [locating, setLocating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [business, setBusiness] = useState(init ? init.business : null);

  // ── Offline attendance policy (spec §33) ──────────────────────────────
  const [offlineEnabled, setOfflineEnabled] = useState(init ? init.offlineEnabled : true);
  const [offlineAllowClockIn, setOfflineAllowClockIn] = useState(init ? init.offlineAllowClockIn : true);
  const [offlineAllowClockOut, setOfflineAllowClockOut] = useState(init ? init.offlineAllowClockOut : true);

  const staticCanvasRef = useRef(null);

  const load = useCallback(async () => {
    try {
      // Blocking spinner unless we are already showing a cached copy (first
      // load after mount only; later loads, e.g. after saving, behave as before).
      if (!seededRef.current) setLoading(true);
      seededRef.current = false;
      setError("");
      const [{ data: settings }, { data: biz }] = await Promise.all([
        getAttendanceSettings(),
        getMyBusinessProfile().catch(() => ({ data: null })),
      ]);
      setMethod(settings.attendanceMethod || "DYNAMIC_QR");
      setStaticToken(settings.staticQrToken || null);
      setZoneEnabled(!!settings.attendanceZoneEnabled);
      setLat(settings.attendanceLatitude ?? null);
      setLng(settings.attendanceLongitude ?? null);
      setRadius(settings.attendanceRadiusMeters || 50);
      setOfflineEnabled(settings.offlineAttendanceEnabled ?? true);
      setOfflineAllowClockIn(settings.offlineAllowClockIn ?? true);
      setOfflineAllowClockOut(settings.offlineAllowClockOut ?? true);
      setBusiness(biz);
      // Cached WITHOUT the static QR token (see the seed above).
      putCache(SETTINGS_CACHE_KEY, { settings: { ...settings, staticQrToken: null }, biz });
    } catch (err) {
      console.error("Failed to load attendance settings:", err);
      setError("Couldn't load attendance settings. Please try again.");
    } finally {
      setLoading(false);
      setRevalidating(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Render the static QR whenever we have a token and the canvas is showing.
  useEffect(() => {
    if (method === "STATIC_QR" && staticToken && staticCanvasRef.current) {
      QRCode.toCanvas(staticCanvasRef.current, staticToken, {
        width: 200,
        margin: 1,
        color: { dark: "#0F6E56", light: "#FFFFFF" },
      }).catch(() => {});
    }
  }, [method, staticToken]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("error", "Location isn't available on this device/browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
        showToast("ok", "Current location captured.");
      },
      () => {
        setLocating(false);
        showToast(
          "error",
          "Couldn't get your location. Check your browser's location permission.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleRegenerateStaticQr = async () => {
    if (
      staticToken &&
      !window.confirm(
        "Regenerating creates a brand-new code and invalidates the current one - any printed copies will stop working. Continue?",
      )
    )
      return;
    try {
      setRegenerating(true);
      const { data } = await regenerateStaticQr();
      setStaticToken(data.staticQrToken);
      showToast("ok", "New static QR code generated.");
    } catch {
      showToast("error", "Couldn't generate a new code. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (method === "STATIC_QR" && !staticToken) {
      // First time switching to Static QR - issue a token before saving.
      try {
        setRegenerating(true);
        const { data } = await regenerateStaticQr();
        setStaticToken(data.staticQrToken);
      } catch {
        setRegenerating(false);
        showToast("error", "Couldn't set up your static QR code.");
        return;
      }
      setRegenerating(false);
    }
    if (zoneEnabled && (lat == null || lng == null)) {
      showToast(
        "error",
        'Set your Attendance Zone location before saving - tap "Use current location".',
      );
      return;
    }
    try {
      setSaving(true);
      await updateAttendanceSettings({
        attendanceMethod: method,
        attendanceZoneEnabled: zoneEnabled,
        attendanceLatitude: lat,
        attendanceLongitude: lng,
        attendanceRadiusMeters: radius,
        offlineAttendanceEnabled: offlineEnabled,
        offlineAllowClockIn: offlineAllowClockIn,
        offlineAllowClockOut: offlineAllowClockOut,
      });
      showToast("ok", "Attendance settings saved.");
    } catch {
      showToast("error", "Couldn't save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!staticToken || !staticCanvasRef.current) return;
    let jsPDF;
    try {
      ({ jsPDF } = await import("jspdf"));
    } catch {
      showToast(
        "error",
        "PDF export isn't available yet - run npm install and reload.",
      );
      return;
    }
    const qrDataUrl = staticCanvasRef.current.toDataURL("image/png");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const centerX = pageWidth / 2;

    if (business?.logo) {
      try {
        doc.addImage(business.logo, "PNG", centerX - 12, 22, 24, 24);
      } catch {
        /* logo may be a remote URL jsPDF can't embed synchronously - skip silently */
      }
    }

    doc.setFontSize(20);
    doc.setTextColor(15, 110, 86);
    doc.text(business?.name || "Your Business", centerX, 58, {
      align: "center",
    });

    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text("Attendance check-in code", centerX, 66, { align: "center" });

    const qrSize = 80;
    doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, 78, qrSize, qrSize);

    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Scan this QR with the Ehral app to check in.", centerX, 172, {
      align: "center",
    });

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Powered by Ehral", centerX, 285, { align: "center" });

    doc.save(
      `${(business?.name || "attendance").replace(/\s+/g, "-").toLowerCase()}-qr-code.pdf`,
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading attendance settings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <i className="ti ti-alert-circle" aria-hidden="true" />
        <p>{error}</p>
        <button className={styles.retryBtn} onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.settingsWrap}>
      {toast && (
        <div
          className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastOk}`}
        >
          <i
            className={`ti ${toast.type === "error" ? "ti-alert-circle" : "ti-circle-check"}`}
            aria-hidden="true"
          />
          {toast.text}
        </div>
      )}

      {/* ── Attendance method ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3>Attendance method</h3>
          <p>Choose how employees check in at this workplace.</p>
        </div>

        <div className={styles.methodGrid}>
          <button
            type="button"
            className={`${styles.methodCard} ${method === "DYNAMIC_QR" ? styles.methodCardActive : ""}`}
            onClick={() => setMethod("DYNAMIC_QR")}
          >
            <div className={styles.methodIcon}>
              <i className="ti ti-refresh" aria-hidden="true" />
            </div>
            <div className={styles.methodInfo}>
              <span className={styles.methodName}>
                Dynamic QR
                <span className={styles.recommendedTag}>Recommended</span>
              </span>
              <span className={styles.methodDesc}>
                A code that refreshes every 10 seconds. Best for a laptop,
                tablet, TV, or reception monitor at your entrance.
              </span>
            </div>
            {method === "DYNAMIC_QR" && (
              <i
                className={`ti ti-circle-check-filled ${styles.checkIcon}`}
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            className={`${styles.methodCard} ${method === "STATIC_QR" ? styles.methodCardActive : ""}`}
            onClick={() => setMethod("STATIC_QR")}
          >
            <div className={styles.methodIcon}>
              <i className="ti ti-printer" aria-hidden="true" />
            </div>
            <div className={styles.methodInfo}>
              <span className={styles.methodName}>Static QR</span>
              <span className={styles.methodDesc}>
                One permanent code you print and stick on the wall. No screen
                needed - great for a salon, small shop, or clinic.
              </span>
            </div>
            {method === "STATIC_QR" && (
              <i
                className={`ti ti-circle-check-filled ${styles.checkIcon}`}
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {method === "STATIC_QR" && (
          <div className={styles.staticQrCard}>
            <div className={styles.staticQrPreview}>
              {staticToken ? (
                <canvas ref={staticCanvasRef} className={styles.staticCanvas} />
              ) : (
                <div className={styles.staticQrEmpty}>
                  <i className="ti ti-qrcode" aria-hidden="true" />
                  <p>Your code will be generated when you save</p>
                </div>
              )}
            </div>

            <div className={styles.staticQrActions}>
              <p className={styles.staticQrHint}>
                {staticToken
                  ? "This code stays valid until you regenerate it. Print it and place it somewhere visible."
                  : "Save your settings to generate this workplace's permanent QR code."}
              </p>

              <div className={styles.staticQrBtnRow}>
                <button
                  type="button"
                  className={styles.pdfBtn}
                  disabled={!staticToken}
                  onClick={handleDownloadPdf}
                >
                  <i className="ti ti-file-type-pdf" aria-hidden="true" />
                  Download PDF
                </button>
                <button
                  type="button"
                  className={styles.wordBtn}
                  disabled
                  title="Coming soon"
                >
                  <i className="ti ti-file-type-doc" aria-hidden="true" />
                  Download Word
                  <span className={styles.soonTag}>Soon</span>
                </button>
              </div>

              {staticToken && (
                <button
                  type="button"
                  className={styles.regenBtn}
                  onClick={handleRegenerateStaticQr}
                  disabled={regenerating}
                >
                  <i className="ti ti-refresh" aria-hidden="true" />
                  {regenerating ? "Generating…" : "Regenerate code"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Attendance zone ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h3>Attendance zone</h3>
            <p>
              Require employees to be physically at your workplace to check in.
              Optional - off by default.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={zoneEnabled}
            className={`${styles.switch} ${zoneEnabled ? styles.switchOn : ""}`}
            onClick={() => setZoneEnabled((v) => !v)}
          >
            <span className={styles.knob} />
          </button>
        </div>

        {zoneEnabled && (
          <div className={styles.zoneCard}>
            <div className={styles.zoneLocationRow}>
              <div className={styles.zoneLocationInfo}>
                <i
                  className={`ti ti-map-pin ${lat != null ? styles.pinSet : ""}`}
                  aria-hidden="true"
                />
                <div>
                  <span className={styles.zoneLocationLabel}>
                    {lat != null ? "Location set" : "Location not set"}
                  </span>
                  {lat != null && (
                    <span className={styles.zoneLocationCoords}>
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.locateBtn}
                onClick={handleUseCurrentLocation}
                disabled={locating}
              >
                <i
                  className={`ti ${locating ? "ti-loader-2" : "ti-current-location"}`}
                  aria-hidden="true"
                />
                {locating ? "Locating…" : "Use current location"}
              </button>
            </div>

            <div className={styles.radiusBlock}>
              <span className={styles.radiusLabel}>Attendance radius</span>
              <div className={styles.radiusOptions}>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.radiusBtn} ${radius === r ? styles.radiusBtnActive : ""}`}
                    onClick={() => setRadius(r)}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Offline attendance ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h3>Offline attendance</h3>
            <p>
              Let employees on a device Ehral already recognizes clock in or out
              without an internet connection. Verified automatically the next
              time they're back online.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={offlineEnabled}
            className={`${styles.switch} ${offlineEnabled ? styles.switchOn : ""}`}
            onClick={() => setOfflineEnabled((v) => !v)}
          >
            <span className={styles.knob} />
          </button>
        </div>

        {offlineEnabled && (
          <div className={styles.zoneCard}>
            <div className={styles.subToggleRow}>
              <span className={styles.subToggleLabel}>
                Allow offline clock-in
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={offlineAllowClockIn}
                className={`${styles.switch} ${styles.switchSmall} ${offlineAllowClockIn ? styles.switchOn : ""}`}
                onClick={() => setOfflineAllowClockIn((v) => !v)}
              >
                <span className={styles.knob} />
              </button>
            </div>
            <div className={styles.subToggleRow}>
              <span className={styles.subToggleLabel}>
                Allow offline clock-out
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={offlineAllowClockOut}
                className={`${styles.switch} ${styles.switchSmall} ${offlineAllowClockOut ? styles.switchOn : ""}`}
                onClick={() => setOfflineAllowClockOut((v) => !v)}
              >
                <span className={styles.knob} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Attendance & Device Security explanation (spec §34) ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h3>Attendance &amp; device security</h3>
            <p>How Ehral decides what's trusted, online and offline.</p>
          </div>
        </div>

        <div className={styles.policyCard}>
          <div className={styles.policyBlock}>
            <h4>
              <i className="ti ti-wifi" aria-hidden="true" />
              Online attendance
            </h4>
            <p>
              Employees can record attendance while connected to the internet.
              Ehral verifies attendance with the server in real time. Recognized
              devices work normally. A new device can be verified online and may
              be registered as an additional device according to your business's
              attendance security policy. New or suspicious device activity may
              generate a security alert.
            </p>
          </div>

          <div className={styles.policyBlock}>
            <h4>
              <i className="ti ti-cloud-off" aria-hidden="true" />
              Offline attendance
            </h4>
            <p>
              Offline attendance is restricted to devices Ehral has previously
              recognized and authorized - a new or unrecognized device can't
              record attendance while offline, no matter how the settings above
              are configured. Authorization is also tied to the specific
              employee it was issued to, so handing an authorized phone to a
              coworker doesn't let them clock offline on it.
            </p>
          </div>

          <div className={styles.policyBlock}>
            <h4>
              <i className="ti ti-database" aria-hidden="true" />
              Browser storage
            </h4>
            <p>
              Ehral keeps employee-device relationships on the server. Clearing
              browser storage or site data does not remove a device from Ehral's
              records. However, it may remove the security credential stored in
              the browser. If that credential is lost, the device can't be used
              for offline attendance until it reconnects to the internet and is
              verified again.
            </p>
          </div>

          <div className={styles.policyBlock}>
            <h4>
              <i className="ti ti-shield-check" aria-hidden="true" />
              Why this matters
            </h4>
            <p>
              Offline attendance can't communicate with Ehral in real time.
              Restricting it to previously authorized devices helps prevent
              employees from bypassing device security by switching devices or
              clearing browser storage while disconnected.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.saveBar}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving || regenerating || revalidating}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
