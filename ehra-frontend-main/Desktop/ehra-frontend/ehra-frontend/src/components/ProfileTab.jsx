import { useState, useRef } from "react";
import { uploadProfilePicture, uploadIdCard } from "../api/workforceApi";
import { updateMyProfile } from "../api/employeeApi";
import {
  submitProfileEdit,
  getMyProfileEdits,
  cancelProfileEdit,
} from "../api/profileEditApi";
import styles from "./ProfileTab.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function fmt(v) {
  return v || "—";
}

function formatEmploymentType(v) {
  if (!v) return "—";
  return v === "PART_TIME" ? "Part-time" : v === "FULL_TIME" ? "Full-time" : v;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CFG = {
  PENDING_HOD: {
    label: "Awaiting HOD",
    bg: "var(--warning-bg)",
    color: "var(--warning-text)",
    icon: "ti-clock",
  },
  PENDING_EMPLOYER: {
    label: "Awaiting employer",
    bg: "var(--warning-bg)",
    color: "var(--warning-text)",
    icon: "ti-clock",
  },
  APPROVED: {
    label: "Applied",
    bg: "var(--bg-soft-accent)",
    color: "var(--accent-hover)",
    icon: "ti-circle-check",
  },
  REJECTED: {
    label: "Rejected",
    bg: "var(--danger-bg)",
    color: "var(--danger-text)",
    icon: "ti-circle-x",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "var(--bg-surface-alt)",
    color: "var(--text-secondary)",
    icon: "ti-circle-minus",
  },
};

// ── Diff row — shows old → new for a single field ──────────────────────────
function DiffRow({ label, oldVal, newVal }) {
  if (!newVal) return null;
  return (
    <div className={styles.diffRow}>
      <span className={styles.diffLabel}>{label}</span>
      <span className={styles.diffOld}>{oldVal || "—"}</span>
      <i className="ti ti-arrow-right" />
      <span className={styles.diffNew}>{newVal}</span>
    </div>
  );
}

// ── Avatar with upload overlay ─────────────────────────────────────────────
function AvatarUpload({ profilePictureUrl, firstName, lastName, onUploaded }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadProfilePicture(file);
      onUploaded(data.url || data);
    } catch {
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className={styles.avatarWrap}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      {profilePictureUrl ? (
        <img
          src={profilePictureUrl}
          alt="Profile"
          className={styles.avatarImg}
        />
      ) : (
        <div className={styles.avatarFallback}>
          {initials(firstName, lastName)}
        </div>
      )}
      <div className={styles.avatarOverlay}>
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

// ── Main ProfileTab ────────────────────────────────────────────────────────

export default function ProfileTab({
  profile,
  onProfileUpdated,
  selfApprove = false,
}) {
  const [tab, setTab] = useState("view");
  const [selfForm, setSelfForm] = useState({
    phone: profile?.phone || "",
    dateOfBirth: profile?.dateOfBirth || "",
    gender: profile?.gender || "",
    address: profile?.address || "",
    emergencyContactName: profile?.emergencyContactName || "",
    emergencyContactPhone: profile?.emergencyContactPhone || "",
    profilePictureUrl: profile?.profilePictureUrl || "",
  });
  const [supervisedForm, setSupervisedForm] = useState({
    firstName: "",
    lastName: "",
    position: "",
    idCardUrl: "",
  });
  const [editRequests, setEditRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Load history when switching to the history tab
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await getMyProfileEdits();
      setEditRequests(data);
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "history") loadHistory();
    setError("");
    setSuccess("");
  };

  // Self-service fields form handler
  const handleSelfChange = (e) =>
    setSelfForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // Supervised fields form handler
  const handleSupervisedChange = (e) =>
    setSupervisedForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const hasSupervisedChange =
    (supervisedForm.firstName &&
      supervisedForm.firstName !== profile?.firstName) ||
    (supervisedForm.lastName &&
      supervisedForm.lastName !== profile?.lastName) ||
    (supervisedForm.position &&
      supervisedForm.position !== profile?.position) ||
    (supervisedForm.idCardUrl &&
      supervisedForm.idCardUrl !== profile?.idCardUrl);

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const payload = {
        // Self-service
        phone: selfForm.phone || null,
        dateOfBirth: selfForm.dateOfBirth || null,
        gender: selfForm.gender || null,
        address: selfForm.address || null,
        emergencyContactName: selfForm.emergencyContactName || null,
        emergencyContactPhone: selfForm.emergencyContactPhone || null,
        profilePictureUrl: selfForm.profilePictureUrl || null,
        // Supervised (only include if changed)
        firstName: supervisedForm.firstName || null,
        lastName: supervisedForm.lastName || null,
        position: supervisedForm.position || null,
        idCardUrl: supervisedForm.idCardUrl || null,
      };
      const { data } = selfApprove
        ? await updateMyProfile(payload)
        : await submitProfileEdit(payload);
      if (onProfileUpdated) await onProfileUpdated();
      setSuccess(
        selfApprove
          ? "Your profile has been updated."
          : hasSupervisedChange
            ? "Your personal info was saved instantly. Name/role/ID card changes have been sent for approval."
            : "Your profile has been updated.",
      );
      setSupervisedForm({
        firstName: "",
        lastName: "",
        position: "",
        idCardUrl: "",
      });
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

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this request?")) return;
    try {
      await cancelProfileEdit(id);
      await loadHistory();
    } catch {
      alert("Could not cancel the request.");
    }
  };

  if (!profile) return <p className={styles.loading}>Loading profile…</p>;

  const pending = editRequests.find(
    (r) => r.status === "PENDING_HOD" || r.status === "PENDING_EMPLOYER",
  );

  return (
    <div className={styles.wrap}>
      {/* ── Header bar ── */}
      <div className={styles.header}>
        <AvatarUpload
          profilePictureUrl={
            selfForm.profilePictureUrl || profile.profilePictureUrl
          }
          firstName={profile.firstName}
          lastName={profile.lastName}
          onUploaded={(url) => {
            setSelfForm((p) => ({ ...p, profilePictureUrl: url }));
            onProfileUpdated?.();
          }}
        />
        <div className={styles.headerInfo}>
          <h2 className={styles.headerName}>
            {profile.firstName}{" "}
            {profile.middleName ? `${profile.middleName} ` : ""}
            {profile.lastName}
          </h2>
          <p className={styles.headerRole}>
            {fmt(profile.position)} · {fmt(profile.departmentName)}
          </p>
          <p className={styles.headerMeta}>
            <i className="ti ti-building" /> {fmt(profile.businessName)}
            {profile.employeeNumber && (
              <>
                <span className={styles.sep}>·</span>
                <i className="ti ti-id" /> {profile.employeeNumber}
              </>
            )}
          </p>
        </div>
        {pending && (
          <div className={styles.pendingBadge}>
            <i className="ti ti-clock" /> Change request pending
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {[
          { key: "view", icon: "ti-user", label: "Profile" },
          { key: "edit", icon: "ti-pencil", label: "Edit" },
          { key: "history", icon: "ti-history", label: "Requests" },
        ].map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => handleTabChange(t.key)}
          >
            <i className={`ti ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ VIEW TAB ══════════ */}
      {tab === "view" && (
        <div className={styles.body}>
          <Section title="Personal information" icon="ti-user">
            <Field label="First name" value={profile.firstName} />
            <Field label="Middle name" value={profile.middleName} />
            <Field label="Last name" value={profile.lastName} />
            <Field
              label="Date of birth"
              value={formatDate(profile.dateOfBirth)}
            />
            <Field label="Gender" value={profile.gender} />
          </Section>

          <Section title="Contact" icon="ti-mail">
            <Field label="Email" value={profile.email} />
            <Field label="Phone" value={profile.phone} />
            <Field label="Address" value={profile.address} span />
          </Section>

          <Section title="Emergency contact" icon="ti-heart">
            <Field label="Name" value={profile.emergencyContactName} />
            <Field label="Phone" value={profile.emergencyContactPhone} />
          </Section>

          <Section title="Employment" icon="ti-briefcase">
            <Field label="Employee no." value={profile.employeeNumber} />
            <Field label="Position" value={profile.position} />
            <Field
              label="Employment type"
              value={formatEmploymentType(profile.employmentType)}
            />
            <Field label="Department" value={profile.departmentName} />
            <Field label="Hire date" value={formatDate(profile.hireDate)} />
            <Field label="Status" value={profile.status} />
          </Section>

          <Section title="Account" icon="ti-shield">
            <Field label="Role" value={profile.role} />
          </Section>

          <div className={styles.editCta}>
            <button
              className={styles.ctaBtn}
              onClick={() => handleTabChange("edit")}
            >
              <i className="ti ti-pencil" /> Edit profile
            </button>
          </div>
        </div>
      )}

      {/* ══════════ EDIT TAB ══════════ */}
      {tab === "edit" && (
        <div className={styles.body}>
          {pending && (
            <div className={styles.infoBox}>
              <i className="ti ti-info-circle" />
              <div>
                <strong>A change request is already in review.</strong>
                <p>
                  You can still update your personal info below. To submit
                  another name/role change, cancel the pending request first.
                </p>
              </div>
            </div>
          )}

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

          {/* ── Instant fields ── */}
          <div className={styles.sectionWrap}>
            <div className={styles.sectionHead}>
              <i className="ti ti-bolt" />
              <div>
                <p className={styles.sectionTitle}>
                  Personal &amp; contact info
                </p>
                <p className={styles.sectionSub}>
                  Changes here save immediately — no approval needed.
                </p>
              </div>
            </div>
            <div className={styles.grid2}>
              <FormField
                label="Phone"
                name="phone"
                value={selfForm.phone}
                onChange={handleSelfChange}
                type="tel"
                placeholder={fmt(profile.phone)}
              />
              <FormField
                label="Gender"
                name="gender"
                value={selfForm.gender}
                onChange={handleSelfChange}
                type="select"
                options={[
                  "",
                  "Male",
                  "Female",
                  "Non-binary",
                  "Prefer not to say",
                ]}
                placeholder={fmt(profile.gender)}
              />
              <FormField
                label="Date of birth"
                name="dateOfBirth"
                value={selfForm.dateOfBirth}
                onChange={handleSelfChange}
                type="date"
                placeholder={profile.dateOfBirth || ""}
              />
              <FormField
                label="Address"
                name="address"
                value={selfForm.address}
                onChange={handleSelfChange}
                placeholder={fmt(profile.address)}
                span
              />
              <FormField
                label="Emergency contact name"
                name="emergencyContactName"
                value={selfForm.emergencyContactName}
                onChange={handleSelfChange}
                placeholder={fmt(profile.emergencyContactName)}
              />
              <FormField
                label="Emergency contact phone"
                name="emergencyContactPhone"
                value={selfForm.emergencyContactPhone}
                onChange={handleSelfChange}
                type="tel"
                placeholder={fmt(profile.emergencyContactPhone)}
              />
            </div>
          </div>

          {/* ── Supervised fields ── */}
          <div className={styles.sectionWrap}>
            <div className={styles.sectionHead}>
              <i className="ti ti-lock" />
              <div>
                <p className={styles.sectionTitle}>
                  Name &amp; employment details
                </p>
                <p className={styles.sectionSub}>
                  {selfApprove ? (
                    "As the employer, changes here save immediately — you don't need approval."
                  ) : (
                    <>
                      Changes here go to{" "}
                      {profile.hodName ? `${profile.hodName} (HOD) then ` : ""}
                      your employer for approval before they take effect.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className={styles.grid2}>
              <FormField
                label="First name"
                name="firstName"
                value={supervisedForm.firstName}
                onChange={handleSupervisedChange}
                placeholder={profile.firstName}
                disabled={!!pending}
              />
              <FormField
                label="Last name"
                name="lastName"
                value={supervisedForm.lastName}
                onChange={handleSupervisedChange}
                placeholder={profile.lastName}
                disabled={!!pending}
              />
              <FormField
                label="Position / Job title"
                name="position"
                value={supervisedForm.position}
                onChange={handleSupervisedChange}
                placeholder={fmt(profile.position)}
                disabled={!!pending}
              />
            </div>

            {/* ID card upload — supervised, requires approval */}
            <div
              className={`${styles.uploadRow} ${pending ? styles.formFieldDisabled : ""}`}
            >
              <span className={styles.uploadLabel}>
                <i className="ti ti-id" /> ID card / document
              </span>
              {supervisedForm.idCardUrl || profile.idCardUrl ? (
                <a
                  href={supervisedForm.idCardUrl || profile.idCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.viewLink}
                >
                  <i className="ti ti-external-link" /> View current
                </a>
              ) : null}
              <label
                className={`${styles.uploadBtn} ${pending ? styles.formFieldDisabled : ""}`}
              >
                <i className="ti ti-upload" /> Upload new
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className={styles.hiddenInput}
                  disabled={!!pending}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { data } = await uploadIdCard(file);
                      setSupervisedForm((p) => ({
                        ...p,
                        idCardUrl: data.url || data,
                      }));
                    } catch {
                      alert("Upload failed.");
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {supervisedForm.idCardUrl &&
                supervisedForm.idCardUrl !== profile.idCardUrl && (
                  <span className={styles.uploadPendingNote}>
                    New file selected — submit below to send for approval.
                  </span>
                )}
            </div>

            {!!pending && (
              <p className={styles.lockedNote}>
                <i className="ti ti-lock" /> These fields are locked while your
                previous request is in review.
                <button
                  className={styles.linkBtn}
                  onClick={() => handleTabChange("history")}
                >
                  View request →
                </button>
              </p>
            )}
          </div>

          <div className={styles.saveRow}>
            <button
              className={styles.saveBtn}
              onClick={handleSubmit}
              disabled={submitting}
            >
              <i className="ti ti-device-floppy" />
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <p className={styles.saveMeta}>
              {selfApprove
                ? "All changes save instantly — you approve your own edits."
                : "Personal info saves instantly. Name/role changes go for approval."}
            </p>
          </div>
        </div>
      )}

      {/* ══════════ HISTORY TAB ══════════ */}
      {tab === "history" && (
        <div className={styles.body}>
          {loadingHistory ? (
            <p className={styles.loading}>Loading…</p>
          ) : editRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <i className="ti ti-history" />
              <p>No change requests yet.</p>
              <p className={styles.emptySmall}>
                When you submit a request to change your name, position,
                employment details, or ID card, it'll show up here.
              </p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {editRequests.map((r) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.CANCELLED;
                const isOpen = expandedId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`${styles.historyCard} ${isOpen ? styles.historyCardOpen : ""}`}
                  >
                    <button
                      className={styles.historyCardHead}
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                    >
                      <span className={styles.historyDate}>
                        {formatDate(r.createdAt)}
                      </span>
                      <span className={styles.historyChangeSummary}>
                        {[
                          r.newFirstName && "First name",
                          r.newLastName && "Last name",
                          r.newPosition && "Position",
                          r.newIdCardUrl && "ID card",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      <span className={styles.historySpacer} />
                      <span
                        className={styles.historyStatus}
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <i className={`ti ${cfg.icon}`} /> {cfg.label}
                      </span>
                      <i
                        className={`ti ti-chevron-down ${styles.historyChevron}`}
                      />
                    </button>

                    {isOpen && (
                      <div className={styles.historyCardBody}>
                        <div className={styles.diffBlock}>
                          <DiffRow
                            label="First name"
                            oldVal={r.oldFirstName}
                            newVal={r.newFirstName}
                          />
                          <DiffRow
                            label="Last name"
                            oldVal={r.oldLastName}
                            newVal={r.newLastName}
                          />
                          <DiffRow
                            label="Position"
                            oldVal={r.oldPosition}
                            newVal={r.newPosition}
                          />
                          {r.newIdCardUrl && (
                            <div className={styles.diffRow}>
                              <span className={styles.diffLabel}>ID card</span>
                              <a
                                href={r.oldIdCardUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.diffOld}
                              >
                                {r.oldIdCardUrl ? "Current file" : "—"}
                              </a>
                              <i className="ti ti-arrow-right" />
                              <a
                                href={r.newIdCardUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.diffNew}
                              >
                                New file
                              </a>
                            </div>
                          )}
                        </div>

                        {r.hodName && (
                          <div className={styles.approvalStep}>
                            <span className={styles.stepLabel}>
                              HOD — {r.hodName}
                            </span>
                            {r.hodApproved === true && (
                              <span className={styles.stepGreen}>
                                <i className="ti ti-check" /> Approved
                              </span>
                            )}
                            {r.hodApproved === false && (
                              <span className={styles.stepRed}>
                                <i className="ti ti-x" /> Rejected
                                {r.hodNote ? `: "${r.hodNote}"` : ""}
                              </span>
                            )}
                            {r.hodApproved === null && (
                              <span className={styles.stepPending}>
                                <i className="ti ti-clock" /> Pending
                              </span>
                            )}
                          </div>
                        )}

                        {(r.status === "APPROVED" ||
                          r.status === "REJECTED" ||
                          r.employerApproved !== null) && (
                          <div className={styles.approvalStep}>
                            <span className={styles.stepLabel}>Employer</span>
                            {r.employerApproved === true && (
                              <span className={styles.stepGreen}>
                                <i className="ti ti-check" /> Approved
                              </span>
                            )}
                            {r.employerApproved === false && (
                              <span className={styles.stepRed}>
                                <i className="ti ti-x" /> Rejected
                                {r.employerNote ? `: "${r.employerNote}"` : ""}
                              </span>
                            )}
                          </div>
                        )}

                        {(r.status === "PENDING_HOD" ||
                          r.status === "PENDING_EMPLOYER") && (
                          <button
                            className={styles.cancelBtn}
                            onClick={() => handleCancel(r.id)}
                          >
                            <i className="ti ti-x" /> Cancel request
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helper sub-components ────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <i className={`ti ${icon}`} />
        <p className={styles.sectionTitle}>{title}</p>
      </div>
      <div className={styles.fields}>{children}</div>
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div className={`${styles.fieldView} ${span ? styles.fieldSpan : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value || "—"}</span>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  options,
  disabled,
  span,
}) {
  return (
    <div
      className={`${styles.formField} ${span ? styles.fieldSpan : ""} ${disabled ? styles.formFieldDisabled : ""}`}
    >
      <label>{label}</label>
      {type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
        >
          {options?.map((o) => (
            <option key={o} value={o}>
              {o || `— ${placeholder} —`}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </div>
  );
}
