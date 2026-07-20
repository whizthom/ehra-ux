import { useEffect, useState, useCallback, useRef } from "react";
import {
  submitProfileEdit,
  getMyProfileEdits,
  cancelProfileEdit,
  getHodPendingEdits,
  submitHodDecision,
} from "../api/profileEditApi";
import { uploadIdCard, uploadProfilePicture } from "../api/workforceApi";
import ProfileEditApprovalPanel from "./ProfileEditApprovalPanel";
import styles from "./EmployeeProfileEditsTab.module.css";

const STATUS_LABEL = {
  PENDING_HOD: "Awaiting HOD",
  PENDING_EMPLOYER: "Awaiting employer",
  APPROVED: "Applied",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

const BLANK = {
  firstName: "",
  lastName: "",
  email: "",
  position: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  idCardUrl: "",
  profilePictureUrl: "",
};

// Avatar shown at the top of the form: the initials-in-a-circle icon isn't
// static — it reflects the employee's actual current profile picture once
// they have one, and clicking it lets them pick a new photo right here.
// Like everything else on this form, a new photo doesn't take effect
// immediately — it rides along in the same submit and only becomes the
// employee's live picture once approved (see the pending-preview badge).
function AvatarPicker({
  firstName,
  lastName,
  currentUrl,
  pendingUrl,
  uploading,
  onPick,
}) {
  const inputRef = useRef(null);
  const displayUrl = pendingUrl || currentUrl;

  return (
    <div className={styles.avatarSection}>
      <div
        className={styles.avatarWrap}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Profile" className={styles.avatarImg} />
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
          hidden
          onChange={onPick}
        />
      </div>
      <div>
        <p className={styles.avatarLabel}>Profile picture</p>
        <p className={styles.hint}>
          {pendingUrl
            ? "New photo selected — awaiting approval once submitted."
            : "Click the icon to choose a new photo."}
        </p>
      </div>
    </div>
  );
}

// Replaces the admin-mode `<ProfileEditApprovalPanel mode="employer" />`
// that was previously wired into this tab — an employee session can never
// call GET /profile-edits or /profile-edits/pending (ADMIN only), which
// is why that tab 403'd. This is the actual employee surface: submit a
// change request (every field — name, email, position, ID document,
// profile picture, phone, address, etc. — goes through the HOD/employer
// approval chain, there's no self-service tier), see your own history,
// cancel a pending one — and, for a Head of Department, the existing
// HOD-mode approval panel reused as-is (it already supports mode="hod").
//
// Hire date is intentionally not a field on this form at all — only the
// employer or the employee's HOD can set it (see PositionCell-style
// HireDateCell in WorkforceTab / Hodworkforcetab).
export default function EmployeeProfileEditsTab({ isHod, profile }) {
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [idCardFileName, setIdCardFileName] = useState("");
  const [idCardUploading, setIdCardUploading] = useState(false);
  const [idCardError, setIdCardError] = useState("");
  const idCardInputRef = useRef(null);

  const [pictureUploading, setPictureUploading] = useState(false);
  const [pictureError, setPictureError] = useState("");

  const [hodPending, setHodPending] = useState([]);
  const [loadingHod, setLoadingHod] = useState(isHod);

  const fetchMine = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getMyProfileEdits();
      setMyRequests(data);
    } catch (err) {
      console.error("Failed to load my profile edit requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHodPending = useCallback(async () => {
    if (!isHod) return;
    try {
      setLoadingHod(true);
      const { data } = await getHodPendingEdits();
      setHodPending(data);
    } catch (err) {
      console.error("Failed to load department profile edit requests:", err);
    } finally {
      setLoadingHod(false);
    }
  }, [isHod]);

  useEffect(() => {
    fetchMine();
    fetchHodPending();
  }, [fetchMine, fetchHodPending]);

  const handleIdCardChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdCardError("");
    setIdCardUploading(true);
    try {
      const { data } = await uploadIdCard(file);
      setForm((p) => ({ ...p, idCardUrl: data.url }));
      setIdCardFileName(file.name);
    } catch (err) {
      const data = err?.response?.data;
      setIdCardError(
        typeof data === "string"
          ? data
          : data?.message || "Couldn't upload that file.",
      );
    } finally {
      setIdCardUploading(false);
      if (idCardInputRef.current) idCardInputRef.current.value = "";
    }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureError("");
    setPictureUploading(true);
    try {
      const { data } = await uploadProfilePicture(file);
      setForm((p) => ({ ...p, profilePictureUrl: data.url }));
    } catch (err) {
      const data = err?.response?.data;
      setPictureError(
        typeof data === "string"
          ? data
          : data?.message || "Couldn't upload that photo.",
      );
    } finally {
      setPictureUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    setFormError("");
    const payload = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v.trim()) payload[k] = v.trim();
    });
    if (Object.keys(payload).length === 0) {
      setFormError("Change at least one field before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await submitProfileEdit(payload);
      setForm(BLANK);
      setIdCardFileName("");
      setShowForm(false);
      fetchMine();
    } catch (err) {
      const data = err?.response?.data;
      setFormError(
        typeof data === "string"
          ? data
          : data?.message || "Couldn't submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      await cancelProfileEdit(id);
      fetchMine();
    } catch (err) {
      console.error("Failed to cancel request:", err);
    }
  };

  const handleHodDecide = async (id, approved, note) => {
    await submitHodDecision(id, { approved, note });
    fetchHodPending();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Profile edit requests</h2>
          <p className={styles.subtitle}>
            Update your details. Every change — including your photo and ID
            document — needs approval from your HOD and/or employer before it
            takes effect.
          </p>
        </div>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setShowForm((s) => !s)}
        >
          <i className="ti ti-edit" /> Request a change
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          {formError && <div className={styles.errorBox}>{formError}</div>}

          {pictureError && (
            <div className={styles.errorBox}>{pictureError}</div>
          )}
          <AvatarPicker
            firstName={profile?.firstName}
            lastName={profile?.lastName}
            currentUrl={profile?.profilePictureUrl}
            pendingUrl={form.profilePictureUrl}
            uploading={pictureUploading}
            onPick={handlePictureChange}
          />

          <p className={styles.groupLabel}>
            All changes below require approval
          </p>
          <div className={styles.formRow}>
            <input
              placeholder="First name"
              value={form.firstName}
              onChange={(e) =>
                setForm((p) => ({ ...p, firstName: e.target.value }))
              }
            />
            <input
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) =>
                setForm((p) => ({ ...p, lastName: e.target.value }))
              }
            />
          </div>
          <div className={styles.formRow}>
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              placeholder="Position"
              value={form.position}
              onChange={(e) =>
                setForm((p) => ({ ...p, position: e.target.value }))
              }
            />
          </div>
          <div className={styles.formRow}>
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <div className={styles.fieldGroup}>
              <label htmlFor="dobField" className={styles.fieldLabel}>
                Date of birth
              </label>
              <input
                id="dobField"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                }
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <input
              placeholder="Gender"
              value={form.gender}
              onChange={(e) =>
                setForm((p) => ({ ...p, gender: e.target.value }))
              }
            />
            <input
              placeholder="Address"
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
          <div className={styles.formRow}>
            <input
              placeholder="Emergency contact name"
              value={form.emergencyContactName}
              onChange={(e) =>
                setForm((p) => ({ ...p, emergencyContactName: e.target.value }))
              }
            />
            <input
              placeholder="Emergency contact phone"
              value={form.emergencyContactPhone}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  emergencyContactPhone: e.target.value,
                }))
              }
            />
          </div>

          <p className={styles.groupLabel}>ID document</p>
          {idCardError && <div className={styles.errorBox}>{idCardError}</div>}
          <div className={styles.idCardRow}>
            <button
              type="button"
              className={styles.idCardUploadBtn}
              onClick={() => idCardInputRef.current?.click()}
              disabled={idCardUploading}
            >
              <i className="ti ti-upload" />
              {idCardUploading
                ? "Uploading…"
                : form.idCardUrl
                  ? "Replace file"
                  : "Upload ID document"}
            </button>
            <input
              ref={idCardInputRef}
              type="file"
              accept="image/*,.pdf"
              hidden
              onChange={handleIdCardChange}
            />
            {form.idCardUrl && (
              <span className={styles.idCardFileName}>
                <i className="ti ti-file-check" />{" "}
                {idCardFileName || "New ID document selected"}
              </span>
            )}
          </div>
          <p className={styles.hint}>
            Upload a clear photo or scan (image or PDF) of a government-issued
            ID. It will replace your current one only once approved.
          </p>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={submit}
              disabled={submitting || idCardUploading || pictureUploading}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>My requests</h3>
        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : myRequests.length === 0 ? (
          <p className={styles.empty}>No requests yet.</p>
        ) : (
          <div className={styles.list}>
            {myRequests.map((r) => (
              <div key={r.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowType}>
                    {[
                      r.newFirstName && "Name",
                      r.newEmail && "Email",
                      r.newPosition && "Position",
                      r.newIdCardUrl && "ID document",
                      r.newProfilePictureUrl && "Profile picture",
                      r.newPhone && "Phone",
                      r.newDateOfBirth && "Date of birth",
                      r.newGender && "Gender",
                      r.newAddress && "Address",
                      (r.newEmergencyContactName ||
                        r.newEmergencyContactPhone) &&
                        "Emergency contact",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Profile update"}
                  </span>
                  <span className={styles.rowDate}>
                    Submitted {fmt(r.createdAt)}
                  </span>
                </div>
                <span className={styles.rowStatus}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                {(r.status === "PENDING_HOD" ||
                  r.status === "PENDING_EMPLOYER") && (
                  <button
                    type="button"
                    className={styles.cancelLink}
                    onClick={() => handleCancel(r.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isHod && (
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>
            Department requests awaiting your decision
          </h3>
          <ProfileEditApprovalPanel
            mode="hod"
            pending={hodPending}
            loading={loadingHod}
            onDecide={handleHodDecide}
          />
        </div>
      )}
    </div>
  );
}
