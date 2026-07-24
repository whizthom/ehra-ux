import { useState, useEffect, useRef } from "react";
import { uploadBusinessLogo } from "../api/businessApi";
import ProfileTab from "./ProfileTab";
import SecuritySettingsSection from "./SecuritySettingsSection";
import styles from "./BusinessSettingsTab.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(name) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "B"
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  span,
}) {
  return (
    <label className={`${styles.field} ${span ? styles.fieldSpan : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {type === "textarea" ? (
        <textarea
          className={styles.textarea}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <input
          className={styles.input}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

// ── Logo upload ──────────────────────────────────────────────────────────

function LogoUpload({ logo, name, onUploaded }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadBusinessLogo(file);
      onUploaded(data.url || data);
    } catch {
      alert("Failed to upload logo. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className={styles.logoWrap}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      {logo ? (
        <img src={logo} alt="Business logo" className={styles.logoImg} />
      ) : (
        <div className={styles.logoFallback}>{initials(name)}</div>
      )}
      <div className={styles.logoOverlay}>
        {uploading ? (
          <i className="ti ti-loader-2 ti-spin" />
        ) : (
          <>
            <i className="ti ti-camera" />
            <span>Change</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleFile}
      />
    </div>
  );
}

// ── Personal attendance profile ─────────────────────────────────────────

function AttendanceProfilePanel({ setting, onToggle }) {
  const enabled = !!setting?.attendanceProfileEnabled;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justChanged, setJustChanged] = useState(false);

  const handleFlip = async (nextEnabled) => {
    setError("");
    setSaving(true);
    try {
      await onToggle(nextEnabled);
      setJustChanged(true);
      setTimeout(() => setJustChanged(false), 3000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update this setting.";
      setError(
        typeof msg === "string" ? msg : "Could not update this setting.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.attIconWrap}>
          <i className="ti ti-fingerprint" />
        </div>
        <div>
          <h3 className={styles.headerName}>Personal attendance profile</h3>
          <p className={styles.headerSub}>
            Decide whether your own account is tracked for attendance, exactly
            like your employees.
          </p>
        </div>
      </div>

      <div className={styles.infoBox} style={{ alignItems: "flex-start" }}>
        <i className="ti ti-info-circle" style={{ marginTop: 2 }} />
        <span>
          By default, this is <strong>off</strong> — you're the employer and
          admin, so you aren't clocked in/out and you aren't counted among your
          staff numbers. For example, if you have 6 employees, your dashboard
          shows <strong>6</strong>.
          <br />
          <br />
          Turn this <strong>on</strong> and you'll be added to the same
          clock-in/out schedule as everyone else — you'll scan the same QR code
          to clock in and out, and your attendance will be tracked and reported
          just like any employee's. You'll also be counted as one extra staff
          member everywhere staff totals appear, so 6 employees becomes{" "}
          <strong>7</strong>. You remain the employer and admin the entire time
          — this only affects attendance tracking, nothing else.
        </span>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      <div className={styles.attToggleRow}>
        <div>
          <p className={styles.attToggleLabel}>
            Include me in attendance tracking
          </p>
          <p className={styles.attToggleDesc}>
            {enabled
              ? "On — you clock in/out and count as staff."
              : "Off — your attendance isn't tracked and you don't count as staff."}
          </p>
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleFlip(e.target.checked)}
          />
          <span className={styles.slider} />
        </label>
      </div>

      {justChanged && (
        <div className={styles.successBox}>
          <i className="ti ti-circle-check" />
          Saved —{" "}
          {enabled
            ? "you're now on the attendance schedule."
            : "your attendance tracking is now off."}
        </div>
      )}

      <div
        className={`${styles.attStatusCard} ${enabled ? styles.attStatusOn : ""}`}
      >
        <i className={`ti ${enabled ? "ti-clock-check" : "ti-clock-off"}`} />
        <div>
          <p className={styles.attStatusTitle}>
            {enabled
              ? "You're on the attendance schedule"
              : "You're off the attendance schedule"}
          </p>
          <p className={styles.attStatusDesc}>
            {enabled
              ? "Clock in and out using the same QR scan employees use, and view your own attendance history."
              : "Turn on the toggle above to start clocking in/out and appearing in staff counts."}
          </p>
          {enabled && (
            <a href="/my-attendance" className={styles.attScanLink}>
              <i className="ti ti-qrcode" /> Go to clock in / clock out
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   props.business          business profile { id, name, email, phone, address, logo }
 * @param {boolean}  props.loadingBusiness
 * @param {function} props.onSaveBusiness     (dto) => Promise<void> — PUT /business/me
 * @param {function} props.onLogoUploaded     () => Promise<void> — refetch business profile after logo upload
 * @param {object}   props.myProfile          admin's own employee profile (from GET /employees/me)
 * @param {boolean}  props.loadingMyProfile
 * @param {function} props.onMyProfileUpdated () => Promise<void> — refetch admin's own profile
 */
export default function BusinessSettingsTab({
  business,
  loadingBusiness,
  onSaveBusiness,
  onLogoUploaded,
  myProfile,
  loadingMyProfile,
  onMyProfileUpdated,
  attendanceProfile,
  loadingAttendanceProfile,
  onToggleAttendanceProfile,
}) {
  const [tab, setTab] = useState("business");
  const rootRef = useRef(null);

  // Content now scrolls as one unit through the page-level
  // .contentFullNarrow wrapper rather than its own nested region, so
  // switching sub-tabs no longer resets scroll position automatically —
  // do it explicitly on whichever ancestor is actually scrollable.
  useEffect(() => {
    let node = rootRef.current?.parentElement;
    while (node) {
      if (getComputedStyle(node).overflowY === "auto") {
        node.scrollTo({ top: 0, behavior: "instant" });
        break;
      }
      node = node.parentElement;
    }
  }, [tab]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || "",
        email: business.email || "",
        phone: business.phone || "",
        address: business.address || "",
      });
    }
  }, [business]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await onSaveBusiness(form);
      setSuccess("Business profile updated.");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not save changes.";
      setError(typeof msg === "string" ? msg : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap} ref={rootRef}>
      {/* Sub-tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "business" ? styles.tabActive : ""}`}
          onClick={() => setTab("business")}
        >
          <i className="ti ti-building" /> Business profile
        </button>
        <button
          className={`${styles.tab} ${tab === "me" ? styles.tabActive : ""}`}
          onClick={() => setTab("me")}
        >
          <i className="ti ti-user" /> My profile
        </button>
        <button
          className={`${styles.tab} ${tab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => setTab("attendance")}
        >
          <i className="ti ti-fingerprint" /> Personal attendance profile
        </button>
        <button
          className={`${styles.tab} ${tab === "security" ? styles.tabActive : ""}`}
          onClick={() => setTab("security")}
        >
          <i className="ti ti-shield-lock" /> Security
        </button>
      </div>

      {/* Whichever sub-tab is active renders into this one shared,
          independently-scrolling body — no card/box around it, same
          plain-background treatment as Attendance. */}
      <div className={styles.tabBody}>
        {/* ══ Business profile ══ */}
        {tab === "business" &&
          (loadingBusiness ? (
            <p className={styles.loading}>Loading business profile…</p>
          ) : (
            <>
              <div className={styles.header}>
                <LogoUpload
                  logo={business?.logo}
                  name={business?.name}
                  onUploaded={onLogoUploaded}
                />
                <div>
                  <h3 className={styles.headerName}>
                    {business?.name || "Your business"}
                  </h3>
                  <p className={styles.headerSub}>
                    Company details — visible to your employees and on invite
                    links.
                  </p>
                </div>
              </div>

              <div className={styles.infoBox}>
                <i className="ti ti-bolt" />
                <span>
                  Changes here save immediately. As the employer, you don't need
                  anyone's approval to update your business profile.
                </span>
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <i className="ti ti-alert-circle" /> {error}
                </div>
              )}
              {success && (
                <div className={styles.successBox}>
                  <i className="ti ti-circle-check" /> {success}
                </div>
              )}

              <div className={styles.grid2}>
                <FormField
                  label="Business name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Company name"
                />
                <FormField
                  label="Business email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                />
                <FormField
                  label="Business phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
                <FormField
                  label="Address"
                  name="address"
                  type="textarea"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Business address"
                  span
                />
              </div>

              <div className={styles.saveRow}>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={submitting}
                >
                  <i className="ti ti-device-floppy" />
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                <p className={styles.saveMeta}>
                  Note: your business email doubles as your login — changing it
                  here updates how you sign in too.
                </p>
              </div>
            </>
          ))}

        {/* ══ My profile (admin's own employee profile) ══ */}
        {tab === "me" &&
          (loadingMyProfile ? (
            <p className={styles.loading}>Loading your profile…</p>
          ) : (
            <ProfileTab
              profile={myProfile}
              onProfileUpdated={onMyProfileUpdated}
              selfApprove
            />
          ))}

        {/* ══ Personal attendance profile ══ */}
        {tab === "attendance" &&
          (loadingAttendanceProfile ? (
            <p className={styles.loading}>Loading your attendance profile…</p>
          ) : (
            <AttendanceProfilePanel
              setting={attendanceProfile}
              onToggle={onToggleAttendanceProfile}
            />
          ))}
        {/* ══ Security ══ */}
        {tab === "security" && <SecuritySettingsSection />}
      </div>
    </div>
  );
}
