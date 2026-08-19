import { useEffect, useState, useCallback } from "react";
import {
  getBranchAttendanceSettings,
  updateBranchAttendanceSettings,
} from "../api/branchApi";
import CustomSelect from "./CustomSelect";
import styles from "./BranchAttendanceSettingsPanel.module.css";

const RADIUS_OPTIONS = [30, 50, 100, 200];

const MODE_OPTIONS = [
  { value: "inherit", label: "Inherit business default", icon: "ti-link" },
  { value: "custom", label: "Custom for this branch", icon: "ti-map-pin" },
];

/**
 * Branch-level attendance-zone override — mirrors the business-wide
 * AttendanceSettingsPanel's zone section, but this is one of three states
 * instead of a plain on/off:
 *   - "Inherit business default" (zoneEnabled cleared to null server-side)
 *   - "Custom for this branch" with the zone ON (its own lat/lng/radius)
 *   - "Custom for this branch" with the zone explicitly OFF (overrides an
 *     enabled business-wide zone to NOT apply here)
 * The business's current default is always shown for reference so an
 * admin setting a branch override can see what they're diverging from.
 */
export default function BranchAttendanceSettingsPanel({ branchId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [mode, setMode] = useState("inherit"); // "inherit" | "custom"
  const [customEnabled, setCustomEnabled] = useState(true);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [radius, setRadius] = useState(50);
  const [locating, setLocating] = useState(false);
  const [businessDefaults, setBusinessDefaults] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await getBranchAttendanceSettings(branchId);
      const hasOverride =
        data.zoneEnabled !== null && data.zoneEnabled !== undefined;
      setMode(hasOverride ? "custom" : "inherit");
      setCustomEnabled(hasOverride ? data.zoneEnabled : true);
      setLat(data.latitude ?? null);
      setLng(data.longitude ?? null);
      setRadius(data.radiusMeters || 50);
      setBusinessDefaults({
        enabled: data.businessZoneEnabled,
        lat: data.businessLatitude,
        lng: data.businessLongitude,
        radius: data.businessRadiusMeters,
      });
    } catch {
      setError("Couldn't load this branch's attendance settings.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

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
          "Couldn't get your location. Check browser permissions.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSave = async () => {
    if (mode === "custom" && customEnabled && (lat == null || lng == null)) {
      showToast(
        "error",
        'Set this branch\'s location before saving — tap "Use current location".',
      );
      return;
    }
    try {
      setSaving(true);
      const payload =
        mode === "inherit"
          ? {
              zoneEnabled: null,
              latitude: null,
              longitude: null,
              radiusMeters: null,
            }
          : {
              zoneEnabled: customEnabled,
              latitude: lat,
              longitude: lng,
              radiusMeters: radius,
            };
      await updateBranchAttendanceSettings(branchId, payload);
      showToast("ok", "Branch attendance settings saved.");
    } catch (err) {
      showToast(
        "error",
        err?.response?.data?.message || "Couldn't save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <i className="ti ti-map-pin-cog" aria-hidden="true" />
        Attendance zone
      </div>
      <p className={styles.desc}>
        By default this branch follows your business-wide attendance zone
        setting. Override it here if this branch needs its own location or
        radius — or no zone requirement at all.
      </p>

      {businessDefaults && (
        <div className={styles.businessDefaultBox}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>
            Business default:{" "}
            {businessDefaults.enabled
              ? `zone enabled, ${businessDefaults.radius}m radius`
              : "no zone requirement"}
          </span>
        </div>
      )}

      <div className={styles.field}>
        <label>Mode</label>
        <CustomSelect value={mode} onChange={setMode} options={MODE_OPTIONS} />
      </div>

      {mode === "custom" && (
        <>
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={`${styles.toggle} ${customEnabled ? styles.toggleOn : ""}`}
              onClick={() => setCustomEnabled((v) => !v)}
              role="switch"
              aria-checked={customEnabled}
            >
              <span className={styles.toggleKnob} />
            </button>
            <span className={styles.toggleLabel}>
              {customEnabled
                ? "Require employees to be within range to clock in"
                : "No zone requirement for this branch"}
            </span>
          </div>

          {customEnabled && (
            <>
              <div className={styles.coordRow}>
                <div className={styles.field}>
                  <label>Latitude</label>
                  <input
                    type="number"
                    value={lat ?? ""}
                    onChange={(e) =>
                      setLat(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="—"
                  />
                </div>
                <div className={styles.field}>
                  <label>Longitude</label>
                  <input
                    type="number"
                    value={lng ?? ""}
                    onChange={(e) =>
                      setLng(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="—"
                  />
                </div>
              </div>

              <button
                type="button"
                className={styles.locateBtn}
                onClick={handleUseCurrentLocation}
                disabled={locating}
              >
                <i className="ti ti-current-location" aria-hidden="true" />
                {locating ? "Locating…" : "Use current location"}
              </button>

              <div className={styles.field}>
                <label>Radius</label>
                <div className={styles.radiusRow}>
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`${styles.radiusChip} ${radius === r ? styles.radiusChipActive : ""}`}
                      onClick={() => setRadius(r)}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastOk}`}
        >
          {toast.text}
        </div>
      )}
      {error && <div className={styles.errorBox}>{error}</div>}

      <button
        type="button"
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
