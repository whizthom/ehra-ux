import { useEffect, useState } from "react";
import { getSecuritySettings, toggleTwoFactor } from "../api/phoneAuthApi";
import styles from "./SecuritySettingsSection.module.css";

export default function SecuritySettingsSection() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Confirmation modal state — toggling 2FA either direction requires the
  // current password (see TwoFactorToggleRequestDTO's rationale).
  const [confirming, setConfirming] = useState(null); // "enable" | "disable" | null
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSecuritySettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your security settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openConfirm = (action) => {
    setConfirming(action);
    setPassword("");
    setConfirmError("");
  };

  const handleConfirm = async () => {
    if (!password) {
      setConfirmError("Enter your password to continue.");
      return;
    }
    setSaving(true);
    setConfirmError("");
    try {
      const updated = await toggleTwoFactor(confirming === "enable", password);
      setSettings(updated);
      setConfirming(null);
    } catch (err) {
      setConfirmError(
        err?.response?.data?.message || "Incorrect password. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className={styles.loading}>Loading your security settings…</p>;
  }

  if (error) {
    return (
      <div className={styles.errorBox}>
        <i className="ti ti-alert-circle" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <i className="ti ti-device-mobile" />
          </div>
          <div>
            <h3>Verified phone number</h3>
            <p>This is your Ehra identity and where 2FA codes are sent.</p>
          </div>
        </div>
        <div className={styles.phoneRow}>
          <span className={styles.phoneNumber}>
            {settings?.maskedPhoneNumber || "Not set"}
          </span>
          {settings?.phoneVerified && (
            <span className={styles.verifiedBadge}>
              <i className="ti ti-rosette-discount-check" /> Verified
            </span>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <i className="ti ti-shield-lock" />
          </div>
          <div>
            <h3>Two-Factor Authentication</h3>
            <p>
              When enabled, signing in requires your password AND a code sent to
              your verified phone.
            </p>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>
              {settings?.twoFactorEnabled ? "Enabled" : "Disabled"}
            </p>
            {!settings?.phoneVerified && (
              <p className={styles.toggleHint}>
                A verified phone number is required to enable this.
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings?.twoFactorEnabled}
            disabled={!settings?.phoneVerified}
            className={`${styles.switch} ${settings?.twoFactorEnabled ? styles.switchOn : ""}`}
            onClick={() =>
              openConfirm(settings?.twoFactorEnabled ? "disable" : "enable")
            }
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
      </div>

      {confirming && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setConfirming(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>
              {confirming === "enable"
                ? "Enable Two-Factor Authentication?"
                : "Disable Two-Factor Authentication?"}
            </h4>
            <p>Confirm your password to continue.</p>

            {confirmError && (
              <div className={styles.errorBox}>
                <i className="ti ti-alert-circle" />
                <span>{confirmError}</span>
              </div>
            )}

            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className={styles.modalInput}
              autoFocus
            />

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirming(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : confirming === "enable"
                    ? "Enable"
                    : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
