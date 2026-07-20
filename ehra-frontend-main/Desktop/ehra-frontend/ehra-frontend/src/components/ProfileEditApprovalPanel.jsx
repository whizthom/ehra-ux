import { useState } from "react";
import styles from "./ProfileEditApprovalPanel.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
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
  PENDING_HOD: { label: "Awaiting HOD", cls: "statusPending" },
  PENDING_EMPLOYER: { label: "Awaiting employer", cls: "statusPending" },
  APPROVED: { label: "Applied", cls: "statusApproved" },
  REJECTED: { label: "Rejected", cls: "statusRejected" },
  CANCELLED: { label: "Cancelled", cls: "statusCancelled" },
};

// ── DiffTable — side-by-side before/after for every changed field ─────────

function DiffTable({ req }) {
  const rows = [
    { label: "First name", old: req.oldFirstName, next: req.newFirstName },
    { label: "Last name", old: req.oldLastName, next: req.newLastName },
    { label: "Position", old: req.oldPosition, next: req.newPosition },
    { label: "Phone", old: req.oldPhone, next: req.newPhone },
    {
      label: "Date of birth",
      old: req.oldDateOfBirth,
      next: req.newDateOfBirth,
    },
    { label: "Gender", old: req.oldGender, next: req.newGender },
    { label: "Address", old: req.oldAddress, next: req.newAddress },
    {
      label: "Emergency contact name",
      old: req.oldEmergencyContactName,
      next: req.newEmergencyContactName,
    },
    {
      label: "Emergency contact phone",
      old: req.oldEmergencyContactPhone,
      next: req.newEmergencyContactPhone,
    },
    { label: "Hire date", old: req.oldHireDate, next: req.newHireDate },
  ].filter((r) => r.next); // only show fields that are actually changing

  const idCardChanged = !!req.newIdCardUrl;
  const pictureChanged = !!req.newProfilePictureUrl;

  if (rows.length === 0 && !idCardChanged && !pictureChanged) return null;

  return (
    <div className={styles.diffTable}>
      <div className={styles.diffHead}>
        <span />
        <span className={styles.diffColLabel}>Current</span>
        <span />
        <span className={styles.diffColLabel}>Proposed</span>
      </div>
      {pictureChanged && (
        <div className={styles.diffRow}>
          <span className={styles.diffFieldName}>Profile picture</span>
          <div className={styles.diffValues}>
            {req.oldProfilePictureUrl ? (
              <img
                src={req.oldProfilePictureUrl}
                alt="Current"
                className={styles.diffAvatar}
              />
            ) : (
              <span className={styles.diffOld}>—</span>
            )}
            <i className={`ti ti-arrow-right ${styles.diffArrowIcon}`} />
            <img
              src={req.newProfilePictureUrl}
              alt="Proposed"
              className={styles.diffAvatar}
            />
          </div>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.label} className={styles.diffRow}>
          <span className={styles.diffFieldName}>{r.label}</span>
          <div className={styles.diffValues}>
            <span className={styles.diffOld}>{r.old || "—"}</span>
            <i className={`ti ti-arrow-right ${styles.diffArrowIcon}`} />
            <span className={styles.diffNew}>{r.next}</span>
          </div>
        </div>
      ))}
      {idCardChanged && (
        <div className={styles.diffRow}>
          <span className={styles.diffFieldName}>ID card / document</span>
          <div className={styles.diffValues}>
            {req.oldIdCardUrl ? (
              <a
                href={req.oldIdCardUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.diffOld}
              >
                Current file
              </a>
            ) : (
              <span className={styles.diffOld}>—</span>
            )}
            <i className={`ti ti-arrow-right ${styles.diffArrowIcon}`} />
            <a
              href={req.newIdCardUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.diffNew}
            >
              New file
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval chain progress strip ─────────────────────────────────────────

function ChainStrip({ req }) {
  const needsHod = req.hodId !== undefined; // HOD was part of chain if hodId ever set
  const steps = needsHod
    ? [
        {
          label: "HOD review",
          done: req.hodApproved === true,
          rejected: req.hodApproved === false,
          pending: req.hodApproved === null || req.hodApproved === undefined,
        },
        {
          label: "Employer",
          done: req.employerApproved === true,
          rejected: req.employerApproved === false,
          pending: req.status === "PENDING_EMPLOYER",
        },
      ]
    : [
        {
          label: "Employer",
          done: req.employerApproved === true,
          rejected: req.employerApproved === false,
          pending: req.status === "PENDING_EMPLOYER",
        },
      ];

  return (
    <div className={styles.chainStrip}>
      {steps.map((s, i) => (
        <span key={i} className={styles.chainStep}>
          <span
            className={`${styles.chainDot} ${s.done ? styles.chainDone : s.rejected ? styles.chainRejected : styles.chainPending}`}
          >
            <i
              className={`ti ${s.done ? "ti-check" : s.rejected ? "ti-x" : "ti-clock"}`}
            />
          </span>
          <span className={styles.chainLabel}>{s.label}</span>
          {i < steps.length - 1 && (
            <span
              className={`${styles.chainLine} ${s.done ? styles.chainLineDone : ""}`}
            />
          )}
        </span>
      ))}
    </div>
  );
}

// ── Single request card ───────────────────────────────────────────────────

function RequestCard({ req, onDecide, actioning, mode }) {
  const [noteText, setNoteText] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const cfg = STATUS_CFG[req.status] || STATUS_CFG.CANCELLED;
  const busy = actioning === req.id;
  const canAct =
    mode === "hod"
      ? req.status === "PENDING_HOD"
      : req.status === "PENDING_EMPLOYER";

  return (
    <div className={`${styles.card} ${canAct ? styles.cardActionable : ""}`}>
      {/* Card header */}
      <div className={styles.cardHeader}>
        <div className={styles.empRow}>
          <div className={styles.avatar}>
            {req.employeeProfilePictureUrl ? (
              <img
                src={req.employeeProfilePictureUrl}
                alt=""
                className={styles.avatarImg}
              />
            ) : (
              <span className={styles.avatarFallback}>
                {initials(req.employeeFirstName, req.employeeLastName)}
              </span>
            )}
          </div>
          <div className={styles.empInfo}>
            <span className={styles.empName}>
              {req.employeeFirstName} {req.employeeLastName}
            </span>
            <span className={styles.empMeta}>
              {req.employeeDepartment}
              {req.employeePosition && ` · ${req.employeePosition}`}
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.submittedAt}>
            Submitted {formatDate(req.createdAt)}
          </span>
          <span className={`${styles.statusPill} ${styles[cfg.cls]}`}>
            {cfg.label}
          </span>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          {/* Approval chain position */}
          <ChainStrip req={req} />

          {/* What's changing */}
          <div className={styles.diffSection}>
            <p className={styles.diffSectionLabel}>
              <i className="ti ti-git-diff" /> Requested changes
            </p>
            <DiffTable req={req} />
          </div>

          {/* HOD decision (only shown to employer if HOD already decided) */}
          {req.hodId &&
            req.hodApproved !== null &&
            req.hodApproved !== undefined && (
              <div className={styles.priorDecision}>
                <i className="ti ti-building" />
                <span>HOD ({req.hodName}): </span>
                {req.hodApproved ? (
                  <span className={styles.priorApproved}>Approved</span>
                ) : (
                  <span className={styles.priorRejected}>Rejected</span>
                )}
                {req.hodNote && (
                  <span className={styles.priorNote}>— "{req.hodNote}"</span>
                )}
              </div>
            )}

          {/* Action buttons — only when this stage is pending for this role */}
          {canAct && !showReject && (
            <div className={styles.actions}>
              <div className={styles.noteFieldRow}>
                <input
                  type="text"
                  className={styles.noteInput}
                  placeholder="Add a note for the employee (optional)"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </div>
              <div className={styles.actionBtns}>
                <button
                  className={styles.approveBtn}
                  disabled={busy}
                  onClick={() => onDecide(req.id, true, noteText)}
                >
                  <i className="ti ti-circle-check" />
                  {busy ? "Approving…" : "Approve changes"}
                </button>
                <button
                  className={styles.rejectTriggerBtn}
                  disabled={busy}
                  onClick={() => setShowReject(true)}
                >
                  <i className="ti ti-circle-x" />
                  Reject
                </button>
              </div>
            </div>
          )}

          {canAct && showReject && (
            <div className={styles.rejectBox}>
              <p className={styles.rejectBoxLabel}>
                <i className="ti ti-alert-triangle" />
                Tell the employee why you're rejecting their changes:
              </p>
              <textarea
                className={styles.rejectNote}
                rows={3}
                placeholder="Reason for rejection (optional but recommended)…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className={styles.rejectBoxBtns}>
                <button
                  className={styles.cancelSmall}
                  onClick={() => {
                    setShowReject(false);
                    setNoteText("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className={styles.rejectConfirmBtn}
                  disabled={busy}
                  onClick={() => onDecide(req.id, false, noteText)}
                >
                  <i className="ti ti-circle-x" />
                  {busy ? "Rejecting…" : "Confirm rejection"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {string}   props.mode          "hod" | "employer"
 * @param {array}    props.pending        requests awaiting this role's decision
 * @param {array}    props.all            full request list (employer only; null for HOD)
 * @param {boolean}  props.loading
 * @param {function} props.onDecide       (id, approved, note) => Promise<void>
 * @param {function} props.onRefresh      () => void  — reload data after a decision
 */
export default function ProfileEditApprovalPanel({
  mode = "employer",
  pending = [],
  all = [],
  loading,
  onDecide,
}) {
  const [view, setView] = useState("pending");
  const [actioning, setActioning] = useState(null);
  const [err, setErr] = useState("");

  const handleDecide = async (id, approved, note) => {
    setActioning(id);
    setErr("");
    try {
      await onDecide(id, approved, note);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data ||
        "Something went wrong.";
      setErr(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setActioning(null);
    }
  };

  const displayList = view === "pending" ? pending : all;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleRow}>
          <i className="ti ti-user-edit" />
          <h3 className={styles.panelTitle}>Profile edit requests</h3>
          {pending.length > 0 && (
            <span className={styles.pendingBadge}>
              {pending.length} pending
            </span>
          )}
        </div>
        <p className={styles.panelSub}>
          {mode === "hod"
            ? "Review profile changes submitted by members of your department. Go through each change carefully before approving."
            : "Review and approve or reject employee profile change requests. All supervised field changes require your final sign-off."}
        </p>
      </div>

      {/* View toggle (employer only — HOD always sees just their pending) */}
      {mode === "employer" && (
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleBtn} ${view === "pending" ? styles.toggleBtnActive : ""}`}
            onClick={() => setView("pending")}
          >
            Pending
            {pending.length > 0 && (
              <span className={styles.toggleCount}>{pending.length}</span>
            )}
          </button>
          <button
            className={`${styles.toggleBtn} ${view === "all" ? styles.toggleBtnActive : ""}`}
            onClick={() => setView("all")}
          >
            All requests
          </button>
        </div>
      )}

      {err && (
        <div className={styles.errorBox}>
          <i className="ti ti-alert-circle" /> {err}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>
          <i className="ti ti-loader-2 ti-spin" />
          <p>Loading requests…</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <i className="ti ti-circle-check" />
          </div>
          <p className={styles.emptyTitle}>
            {view === "pending" ? "All caught up" : "No requests yet"}
          </p>
          <p className={styles.emptySub}>
            {view === "pending"
              ? "There are no profile changes waiting for your review right now."
              : "No profile edit requests have been submitted for this business yet."}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {displayList.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onDecide={handleDecide}
              actioning={actioning}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
