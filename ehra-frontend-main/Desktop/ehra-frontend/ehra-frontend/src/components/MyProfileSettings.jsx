import styles from "./MyProfileSettings.module.css";

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value || "—"}</span>
    </div>
  );
}

// Replaces `<BusinessSettingsTab>` (the company profile editor — ADMIN
// only, GET/PUT /business/me), which is why "Settings" 403'd for an
// employee session. This just surfaces the profile already returned by
// GET /employees/me — read-only here; use "Profile Edits" to request a
// change.
export default function MyProfileSettings({ profile, onGoToProfileEdits }) {
  if (!profile) {
    return <p className={styles.empty}>Loading your profile…</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headerCard}>
        <div className={styles.avatar}>
          {profile.profilePictureUrl ? (
            <img src={profile.profilePictureUrl} alt="" />
          ) : (
            initials(profile.firstName, profile.lastName)
          )}
        </div>
        <div>
          <h2 className={styles.name}>
            {profile.firstName} {profile.lastName}
          </h2>
          <p className={styles.meta}>
            {profile.position || "No position set"}
            {profile.departmentName ? ` · ${profile.departmentName}` : ""}
            {profile.isHod ? " · Head of Department" : ""}
          </p>
        </div>
        <button type="button" className={styles.editBtn} onClick={onGoToProfileEdits}>
          <i className="ti ti-edit" /> Request a change
        </button>
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Contact</h3>
        <Row label="Email" value={profile.email} />
        <Row label="Phone" value={profile.phone} />
        <Row label="Address" value={profile.address} />
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Personal</h3>
        <Row label="Date of birth" value={profile.dateOfBirth} />
        <Row label="Gender" value={profile.gender} />
        <Row label="Emergency contact" value={profile.emergencyContactName} />
        <Row label="Emergency phone" value={profile.emergencyContactPhone} />
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Employment</h3>
        <Row label="Employee number" value={profile.employeeNumber} />
        <Row label="Employment type" value={profile.employmentType} />
        <Row label="Hire date" value={profile.hireDate} />
        <Row label="Status" value={profile.status} />
        <Row label="Business" value={profile.businessName} />
        <Row label="Head of department" value={profile.hodName} />
      </div>
    </div>
  );
}
