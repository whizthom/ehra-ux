import { useEffect, useState, useCallback, useMemo } from "react";
import {
  requestLeave,
  getMyLeaves,
  getMyBalances,
  cancelLeave,
  getPendingHodDecisions,
  getDepartmentLeaves,
  hodDecide,
} from "../api/leaveApi";
import { getCoverCandidates } from "../api/employeeApi";
import { readSession } from "../api/authApi";
import useMessageStream from "../hooks/useMessageStream";
import SelectDropdown from "./SelectDropdown";
import {
  leaveTypeLabel,
  LEAVE_TYPE_ICON,
  leaveStatusConfig,
  leaveStageDescription,
  leaveSteps,
  PROCESSING_STATUSES,
  HISTORY_STATUSES,
  formatDate,
  initials,
} from "../utils/leaveHelpers";
import styles from "./EmployeeLeaveTab.module.css";

const LEAVE_TYPES = [
  "ANNUAL",
  "SICK",
  "MATERNITY",
  "PATERNITY",
  "COMPASSIONATE",
  "BEREAVEMENT",
  "STUDY",
  "UNPAID",
  "EMERGENCY",
  "MARRIAGE",
  "SABBATICAL",
  "PUBLIC_HOLIDAY_LIEU",
];

// A request can still be cancelled by the employee up until the employer's
// final decision — matches the backend rule in LeaveServiceImpl#cancelLeave
// (anything except APPROVED / REJECTED / CANCELLED).
const CANCELLABLE_STATUSES = PROCESSING_STATUSES;

const HISTORY_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

// Outcome statuses a HOD can monitor for their department — cancellations
// aren't a "decision" so they're left out of this view (the request was
// withdrawn, not decided).
const DEPARTMENT_OUTCOME_STATUSES = ["APPROVED", "REJECTED"];

const DEPARTMENT_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

// The department-outcomes list is otherwise unbounded — every decided
// request in the HOD's department, forever. Rather than actually deleting
// anything (this is someone else's leave record, not the HOD's to erase),
// "remove" just hides a row from THIS HOD's view from here on. Scoped by
// membershipId so it's personal to that HOD, and stored in localStorage so
// it survives refresh/relogin. Wrapped in try/catch since localStorage can
// throw in private-browsing/quota-exceeded situations — a failed dismiss
// should never break the page.
function dismissedStorageKey() {
  const { membershipId } = readSession() || {};
  return `ehra:leave:dismissedOutcomes:${membershipId || "anon"}`;
}

function loadDismissedIds() {
  try {
    const raw = localStorage.getItem(dismissedStorageKey());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(set) {
  try {
    localStorage.setItem(dismissedStorageKey(), JSON.stringify([...set]));
  } catch {
    // best-effort — losing the dismissal just means the row reappears
  }
}

function fmt(d) {
  return formatDate(d);
}

// Small circular gauge for one leave-type balance — used-vs-max, exactly
// like Today's Pulse's ring but sized down for a horizontal strip. Types
// with no cap (maxDaysPerYear <= 0 / daysRemaining < 0) render an
// "unlimited" badge instead of a ring, since a percentage doesn't apply.
function BalanceRing({ balance }) {
  const remaining = balance.daysRemaining ?? balance.remainingDays;
  const max = balance.maxDaysPerYear;
  const unlimited = remaining < 0 || !max || max <= 0;

  const R = 24;
  const STROKE = 5;
  const circumference = 2 * Math.PI * R;
  const usedPct = unlimited
    ? 0
    : Math.min(Math.max((balance.daysUsed / max) * 100, 0), 100);
  const offset = circumference * (1 - usedPct / 100);

  return (
    <div className={styles.ringChip}>
      <div className={styles.ringChipSvgWrap}>
        {unlimited ? (
          <div className={styles.ringChipInfinite}>
            <i className="ti ti-infinity" />
          </div>
        ) : (
          <svg viewBox="0 0 56 56" className={styles.ringChipSvg}>
            <circle
              cx="28"
              cy="28"
              r={R}
              className={styles.ringChipTrack}
              strokeWidth={STROKE}
            />
            <circle
              cx="28"
              cy="28"
              r={R}
              className={styles.ringChipProgress}
              strokeWidth={STROKE}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
        )}
        <div className={styles.ringChipCenter}>
          {unlimited ? "∞" : remaining}
        </div>
      </div>
      <span className={styles.ringChipLabel}>
        {leaveTypeLabel(balance.leaveType)}
      </span>
      <span className={styles.ringChipSub}>
        {unlimited ? "unlimited" : `of ${max} left`}
      </span>
    </div>
  );
}

// Horizontal stage tracker — dots connected by a line, each dot colored
// by state (done / current / declined / pending). This is the visual
// heart of the "Processing" section: at a glance you can see exactly
// which of Requested → Cover → HOD → Sign-off a request has cleared.
function StageTrack({ leave }) {
  const steps = leaveSteps(leave);
  return (
    <div className={styles.stageTrack}>
      {steps.map((step, i) => (
        <div className={styles.stageStep} key={step.key}>
          <div className={styles.stageNode}>
            <div
              className={`${styles.stageDot} ${styles["dot_" + step.state]}`}
            >
              {step.state === "done" && <i className="ti ti-check" />}
              {step.state === "declined" && <i className="ti ti-x" />}
              {step.state === "current" && (
                <span className={styles.stagePulse} />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`${styles.stageLine} ${
                  step.state === "done" ? styles.stageLineDone : ""
                }`}
              />
            )}
          </div>
          <span
            className={`${styles.stageLabel} ${
              step.state === "current" ? styles.stageLabelCurrent : ""
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// One card in "Currently processing" — the stage tracker up top, then the
// same detail a plain row would show, plus cancel while still eligible.
function ProcessingCard({ leave, onCancel, cancelling }) {
  const cfg = leaveStatusConfig(leave.status);
  return (
    <div className={styles.processCard}>
      <div className={styles.processTop}>
        <div className={styles.processTopLeft}>
          <span className={styles.rowType}>
            {leaveTypeLabel(leave.leaveType)}
          </span>
          <span className={styles.rowDates}>
            {fmt(leave.startDate)} – {fmt(leave.endDate)} · {leave.days}d
          </span>
        </div>
        <span
          className={styles.rowStatus}
          style={{ background: cfg.bg, color: cfg.color }}
        >
          <i className={`ti ${cfg.icon}`} /> {cfg.label}
        </span>
      </div>

      <StageTrack leave={leave} />

      <p className={styles.processDesc}>{leaveStageDescription(leave)}</p>

      <div className={styles.processFooter}>
        {leave.coverPersonFirstName && (
          <span className={styles.rowCover}>
            <i className="ti ti-user-shield" />
            Cover: {leave.coverPersonFirstName} {leave.coverPersonLastName}
          </span>
        )}
        {CANCELLABLE_STATUSES.includes(leave.status) && (
          <button
            type="button"
            className={styles.cancelLink}
            disabled={cancelling === leave.id}
            onClick={() => onCancel(leave.id)}
          >
            {cancelling === leave.id ? "Cancelling…" : "Cancel request"}
          </button>
        )}
      </div>
    </div>
  );
}

// One row in "History" — finalized requests only, so no stage tracker
// needed; instead show the closing note (rejection reason) when present.
function HistoryRow({ leave }) {
  const cfg = leaveStatusConfig(leave.status);
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTopLine}>
          <span className={styles.rowType}>
            {leaveTypeLabel(leave.leaveType)}
          </span>
          <span
            className={styles.rowStatus}
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <i className={`ti ${cfg.icon}`} /> {cfg.label}
          </span>
        </div>
        <span className={styles.rowDates}>
          {fmt(leave.startDate)} – {fmt(leave.endDate)} · {leave.days}d
        </span>
        {leave.coverPersonFirstName && (
          <span className={styles.rowCover}>
            <i className="ti ti-user-shield" />
            Cover: {leave.coverPersonFirstName} {leave.coverPersonLastName}
          </span>
        )}
        {leave.status === "REJECTED" && leave.adminNote && (
          <span className={styles.rowNote}>Reason: {leave.adminNote}</span>
        )}
      </div>
    </div>
  );
}

// One row in "Department outcomes" — a finalized request from someone in
// the HOD's department, laid out so the HOD can see both halves of the
// decision at a glance: what they themselves decided, and (when their
// approval sent it onward) what the employer ultimately did with it.
// Requests the HOD rejected outright never reach the employer stage, so
// the employer line is only shown when that stage actually happened.
function DepartmentOutcomeRow({ leave, dismissed, onToggleDismiss }) {
  const cfg = leaveStatusConfig(leave.status);
  const hodRejectedOutright =
    leave.status === "REJECTED" && leave.hodApproved === false;
  const reachedEmployer = !hodRejectedOutright && leave.hodDecidedById != null;

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTopLine}>
          <span className={styles.rowType}>
            {leave.employeeFirstName} {leave.employeeLastName} ·{" "}
            {leaveTypeLabel(leave.leaveType)}
          </span>
          <span
            className={styles.rowStatus}
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <i className={`ti ${cfg.icon}`} /> {cfg.label}
          </span>
        </div>
        <span className={styles.rowDates}>
          {fmt(leave.startDate)} – {fmt(leave.endDate)} · {leave.days}d
        </span>
        {leave.coverPersonFirstName && (
          <span className={styles.rowCover}>
            <i className="ti ti-user-shield" />
            Cover: {leave.coverPersonFirstName} {leave.coverPersonLastName}
          </span>
        )}
        <span className={styles.rowReason}>"{leave.reason}"</span>

        <div className={styles.outcomeDetail}>
          <span className={styles.outcomeLine}>
            <i
              className={`ti ${leave.hodApproved ? "ti-circle-check" : "ti-circle-x"}`}
            />
            Your decision: {leave.hodApproved ? "Approved" : "Rejected"}
            {leave.hodDecidedAt ? ` · ${fmt(leave.hodDecidedAt)}` : ""}
          </span>
          {leave.hodNote && (
            <span className={styles.outcomeNote}>"{leave.hodNote}"</span>
          )}

          {reachedEmployer && (
            <>
              <span className={styles.outcomeLine}>
                <i
                  className={`ti ${leave.status === "APPROVED" ? "ti-circle-check" : "ti-circle-x"}`}
                />
                Employer's final decision:{" "}
                {leave.status === "APPROVED" ? "Approved" : "Rejected"}
                {leave.decidedAt ? ` · ${fmt(leave.decidedAt)}` : ""}
              </span>
              {leave.adminNote && (
                <span className={styles.outcomeNote}>"{leave.adminNote}"</span>
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.dismissBtn}
        title={dismissed ? "Restore to list" : "Remove from this list"}
        aria-label={dismissed ? "Restore to list" : "Remove from this list"}
        onClick={() => onToggleDismiss(leave.id)}
      >
        <i className={`ti ${dismissed ? "ti-arrow-back-up" : "ti-x"}`} />
      </button>
    </div>
  );
}

// One row in the HOD decision queue — approve is a single click; reject
// requires typing a reason first, same pattern as the cover-response flow
// so employees see a consistent interaction across both roles.
function HodQueueRow({ leave, onDecide, deciding }) {
  const [mode, setMode] = useState(null); // null | "reject"
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const isBusy = deciding === leave.id;

  const submitReject = () => {
    if (!note.trim()) {
      setError("Please give a reason for rejecting this request.");
      return;
    }
    setError("");
    onDecide(leave.id, false, note.trim());
  };

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTopLine}>
          <span className={styles.rowType}>
            {leave.employeeFirstName} {leave.employeeLastName} ·{" "}
            {leaveTypeLabel(leave.leaveType)}
          </span>
        </div>
        <span className={styles.rowDates}>
          {fmt(leave.startDate)} – {fmt(leave.endDate)} · {leave.days}d
        </span>
        {leave.coverPersonFirstName && (
          <span className={styles.rowCover}>
            <i className="ti ti-user-shield" />
            Cover: {leave.coverPersonFirstName} {leave.coverPersonLastName}
            {leave.coverAccepted ? " (accepted)" : ""}
          </span>
        )}
        <span className={styles.rowReason}>"{leave.reason}"</span>

        {mode === "reject" && (
          <div className={styles.inlineRejectBox}>
            {error && <div className={styles.errorText}>{error}</div>}
            <label>
              Reason for rejecting <span className={styles.req}>*</span>
            </label>
            <textarea
              rows={2}
              autoFocus
              placeholder="Tell them why…"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError("");
              }}
            />
            <div className={styles.inlineRejectBtns}>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={isBusy}
                onClick={() => {
                  setMode(null);
                  setNote("");
                  setError("");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.rejectConfirmBtn}
                disabled={isBusy}
                onClick={submitReject}
              >
                {isBusy ? "Sending…" : "Confirm rejection"}
              </button>
            </div>
          </div>
        )}
      </div>
      {mode !== "reject" && (
        <div className={styles.decideActions}>
          <button
            type="button"
            className={styles.approveBtn}
            disabled={isBusy}
            onClick={() => onDecide(leave.id, true)}
          >
            {isBusy ? "…" : "Approve"}
          </button>
          <button
            type="button"
            className={styles.rejectBtn}
            disabled={isBusy}
            onClick={() => setMode("reject")}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

const BASE_TABS = [
  { key: "request", label: "Request", icon: "ti-calendar-plus" },
  { key: "processing", label: "Processing", icon: "ti-hourglass" },
  { key: "history", label: "History", icon: "ti-history" },
];

const HOD_DEPARTMENT_TAB = {
  key: "department",
  label: "Department",
  icon: "ti-building-community",
};

// Replaces the employer's `LeavesTab` (which pulls the whole business's
// leave queue via GET /leave and approves via POST /leave/{id}/approve —
// both ADMIN only, hence the 403s). This is the actual employee surface:
// request leave, see your own history/balances, cancel a pending request
// — and, if this Identity is a Head of Department, decide on requests
// from their own department (GET/POST /leave/department/...).
//
// Laid out as three tabs — Request, Processing, History — so "submit a
// new request", "where is my pending request right now", and "what
// happened to my past requests" each get a dedicated, uncluttered view
// instead of one long scroll.
export default function EmployeeLeaveTab({ isHod }) {
  const [myLeaves, setMyLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const [tab, setTab] = useState("request");
  const [historyFilter, setHistoryFilter] = useState("ALL");

  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({
    leaveType: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
    coverPersonId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [hodQueue, setHodQueue] = useState([]);
  const [loadingHod, setLoadingHod] = useState(isHod);
  const [decidingId, setDecidingId] = useState(null);
  const [hodError, setHodError] = useState("");

  const [departmentLeaves, setDepartmentLeaves] = useState([]);
  const [loadingDepartment, setLoadingDepartment] = useState(isHod);
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [dismissedIds, setDismissedIds] = useState(() =>
    isHod ? loadDismissedIds() : new Set(),
  );
  const [showDismissed, setShowDismissed] = useState(false);

  const dismissOutcome = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const restoreOutcome = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const restoreAllOutcomes = useCallback(() => {
    setDismissedIds(new Set());
    saveDismissedIds(new Set());
  }, []);

  const fetchMine = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesRes, balancesRes] = await Promise.all([
        getMyLeaves(),
        getMyBalances(),
      ]);
      setMyLeaves(leavesRes.data);
      setBalances(balancesRes.data);
    } catch (err) {
      console.error("Failed to load my leave data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHodQueue = useCallback(async () => {
    if (!isHod) return;
    try {
      setLoadingHod(true);
      const { data } = await getPendingHodDecisions();
      setHodQueue(data);
    } catch (err) {
      console.error("Failed to load department leave requests:", err);
    } finally {
      setLoadingHod(false);
    }
  }, [isHod]);

  // Every leave in the department, finalized or not — filtered down to
  // APPROVED/REJECTED below to show the HOD the outcome of requests
  // they (or, on their behalf, the employer) have already decided on.
  const fetchDepartment = useCallback(async () => {
    if (!isHod) return;
    try {
      setLoadingDepartment(true);
      const { data } = await getDepartmentLeaves();
      setDepartmentLeaves(data);
    } catch (err) {
      console.error("Failed to load department leave outcomes:", err);
    } finally {
      setLoadingDepartment(false);
    }
  }, [isHod]);

  useEffect(() => {
    fetchMine();
    fetchHodQueue();
    fetchDepartment();
  }, [fetchMine, fetchHodQueue, fetchDepartment]);

  useEffect(() => {
    getCoverCandidates(form.startDate || undefined, form.endDate || undefined)
      .then(({ data }) => setCandidates(data))
      .catch(() => setCandidates([]));
  }, [form.startDate, form.endDate]);

  // ── Real-time ────────────────────────────────────────────────────────
  // The pushed LeaveDTO doesn't carry an explicit "this is your own
  // leave" flag, so the reliable way to patch "My requests" and the HOD
  // queue live is: (a) patch in place for any id we already have on
  // screen — cheap and instant, no ambiguity; and (b) on a relevant
  // notification (which the backend only ever sends to someone actually
  // involved), do a light re-fetch to pick up brand-new items. Together
  // these keep both panels current within a fraction of a second of the
  // server-side change, with no manual refresh.
  useMessageStream({
    onLeaveUpdate: (leave) => {
      if (!leave) return;

      setMyLeaves((prev) =>
        prev.some((l) => l.id === leave.id)
          ? prev.map((l) => (l.id === leave.id ? leave : l))
          : prev,
      );

      if (isHod) {
        setHodQueue((prev) => {
          const exists = prev.some((l) => l.id === leave.id);
          if (leave.status === "PENDING_HOD") {
            if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
            return [leave, ...prev];
          }
          return exists ? prev.filter((l) => l.id !== leave.id) : prev;
        });

        setDepartmentLeaves((prev) =>
          prev.some((l) => l.id === leave.id)
            ? prev.map((l) => (l.id === leave.id ? leave : l))
            : [leave, ...prev],
        );
      }
    },
    onNewNotification: (payload) => {
      const LEAVE_TYPES_OF_INTEREST = [
        "LEAVE_REQUESTED",
        "LEAVE_COVER_ACCEPTED",
        "LEAVE_COVER_DECLINED",
        "LEAVE_HOD_APPROVED",
        "LEAVE_HOD_REJECTED",
        "LEAVE_APPROVED",
        "LEAVE_REJECTED",
        "LEAVE_CANCELLED",
        "LEAVE_AWAITING_EMPLOYER",
      ];
      if (LEAVE_TYPES_OF_INTEREST.includes(payload?.type)) {
        fetchMine();
        fetchHodQueue();
        fetchDepartment();
      }
    },
  });

  const leaveTypeOptions = useMemo(
    () =>
      LEAVE_TYPES.map((t) => ({
        value: t,
        label: leaveTypeLabel(t),
        icon: LEAVE_TYPE_ICON[t],
      })),
    [],
  );

  const coverOptions = useMemo(
    () => [
      { value: "", label: "No cover needed", icon: "ti-user-off" },
      ...candidates.map((c) => ({
        value: String(c.id),
        label: `${c.firstName} ${c.lastName}`,
        sublabel: c.email,
        initials: initials(c.firstName, c.lastName),
      })),
    ],
    [candidates],
  );

  const processingLeaves = useMemo(
    () => myLeaves.filter((l) => PROCESSING_STATUSES.includes(l.status)),
    [myLeaves],
  );
  const historyLeaves = useMemo(
    () => myLeaves.filter((l) => HISTORY_STATUSES.includes(l.status)),
    [myLeaves],
  );
  const filteredHistory = useMemo(
    () =>
      historyFilter === "ALL"
        ? historyLeaves
        : historyLeaves.filter((l) => l.status === historyFilter),
    [historyLeaves, historyFilter],
  );

  const departmentOutcomes = useMemo(
    () =>
      departmentLeaves
        .filter((l) => DEPARTMENT_OUTCOME_STATUSES.includes(l.status))
        .sort(
          (a, b) =>
            new Date(b.decidedAt || b.hodDecidedAt || 0) -
            new Date(a.decidedAt || a.hodDecidedAt || 0),
        ),
    [departmentLeaves],
  );
  const visibleDepartmentOutcomes = useMemo(
    () => departmentOutcomes.filter((l) => !dismissedIds.has(l.id)),
    [departmentOutcomes, dismissedIds],
  );
  const dismissedDepartmentOutcomes = useMemo(
    () => departmentOutcomes.filter((l) => dismissedIds.has(l.id)),
    [departmentOutcomes, dismissedIds],
  );
  const departmentOutcomesSource = showDismissed
    ? dismissedDepartmentOutcomes
    : visibleDepartmentOutcomes;
  const filteredDepartmentOutcomes = useMemo(
    () =>
      departmentFilter === "ALL"
        ? departmentOutcomesSource
        : departmentOutcomesSource.filter((l) => l.status === departmentFilter),
    [departmentOutcomesSource, departmentFilter],
  );

  const TABS = useMemo(
    () => (isHod ? [...BASE_TABS, HOD_DEPARTMENT_TAB] : BASE_TABS),
    [isHod],
  );

  const submit = async () => {
    setFormError("");
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setFormError("Please fill in the dates and a reason.");
      return;
    }
    setSubmitting(true);
    try {
      await requestLeave({
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        coverPersonId: form.coverPersonId || undefined,
      });
      setForm({
        leaveType: "ANNUAL",
        startDate: "",
        endDate: "",
        reason: "",
        coverPersonId: "",
      });
      fetchMine();
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3500);
      setTab("processing");
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
    setCancellingId(id);
    try {
      await cancelLeave(id);
      fetchMine();
    } catch (err) {
      console.error("Failed to cancel leave:", err);
    } finally {
      setCancellingId(null);
    }
  };

  const decide = async (id, approved, note) => {
    setHodError("");
    setDecidingId(id);
    try {
      await hodDecide(id, { approved, note });
      fetchHodQueue();
    } catch (err) {
      console.error("Failed to record HOD decision:", err);
      setHodError(
        err?.response?.data?.message ||
          "Couldn't record your decision. Please try again.",
      );
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>My leave</h2>
          <p className={styles.subtitle}>
            Request time off and track your requests.
          </p>
        </div>
      </div>

      {isHod && (
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>
            Team requests awaiting your decision
            {hodQueue.length > 0 && (
              <span className={styles.panelBadge}>{hodQueue.length}</span>
            )}
          </h3>
          {hodError && <div className={styles.errorBox}>{hodError}</div>}
          {loadingHod ? (
            <p className={styles.empty}>Loading…</p>
          ) : hodQueue.length === 0 ? (
            <p className={styles.empty}>Nothing pending in your department.</p>
          ) : (
            <div className={styles.list}>
              {hodQueue.map((l) => (
                <HodQueueRow
                  key={l.id}
                  leave={l}
                  onDecide={decide}
                  deciding={decidingId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.tabBar}>
        {TABS.map((t) => {
          const count =
            t.key === "processing"
              ? processingLeaves.length
              : t.key === "history"
                ? historyLeaves.length
                : t.key === "department"
                  ? visibleDepartmentOutcomes.length
                  : 0;
          return (
            <button
              key={t.key}
              type="button"
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              <i className={`ti ${t.icon}`} />
              {t.label}
              {count > 0 && <span className={styles.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.tabBody}>
        {tab === "request" && (
          <div className={styles.sectionStack}>
            {balances.length > 0 && (
              <div className={styles.ringRow}>
                {balances.map((b) => (
                  <BalanceRing key={b.leaveType} balance={b} />
                ))}
              </div>
            )}

            <div className={styles.formCard}>
              {justSubmitted && (
                <div className={styles.successBox}>
                  <i className="ti ti-circle-check" /> Request submitted — track
                  it under Processing.
                </div>
              )}
              {formError && <div className={styles.errorBox}>{formError}</div>}
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Type</label>
                  <SelectDropdown
                    value={form.leaveType}
                    options={leaveTypeOptions}
                    onChange={(v) => setForm((p) => ({ ...p, leaveType: v }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, endDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label>Reason</label>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder="Briefly explain the reason for this leave"
                />
              </div>
              {candidates.length > 0 && (
                <div className={styles.field}>
                  <label>Cover person (optional)</label>
                  <SelectDropdown
                    value={form.coverPersonId}
                    options={coverOptions}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, coverPersonId: v }))
                    }
                  />
                </div>
              )}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={submit}
                  disabled={submitting}
                >
                  <i className="ti ti-send-2" />
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "processing" && (
          <div className={styles.sectionStack}>
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : processingLeaves.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <i className="ti ti-hourglass-empty" />
                </div>
                <p className={styles.emptyTitle}>Nothing in flight</p>
                <p className={styles.emptyText}>
                  Requests you submit will show up here with a live view of
                  every approval stage.
                </p>
                <button
                  type="button"
                  className={styles.emptyCta}
                  onClick={() => setTab("request")}
                >
                  <i className="ti ti-calendar-plus" /> Request leave
                </button>
              </div>
            ) : (
              <div className={styles.processGrid}>
                {processingLeaves.map((l) => (
                  <ProcessingCard
                    key={l.id}
                    leave={l}
                    onCancel={handleCancel}
                    cancelling={cancellingId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className={styles.sectionStack}>
            <div className={styles.filterChips}>
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${styles.filterChip} ${
                    historyFilter === f.key ? styles.filterChipActive : ""
                  }`}
                  onClick={() => setHistoryFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : filteredHistory.length === 0 ? (
              <p className={styles.empty}>
                {historyFilter === "ALL"
                  ? "You haven't completed any leave requests yet."
                  : "Nothing here yet."}
              </p>
            ) : (
              <div className={styles.list}>
                {filteredHistory.map((l) => (
                  <HistoryRow key={l.id} leave={l} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "department" && isHod && (
          <div className={styles.sectionStack}>
            <div className={styles.deptOutcomesHeader}>
              <p className={styles.subtitle}>
                Outcomes of requests decided in your department — yours to
                monitor even after they've moved past you. Getting crowded? Use
                the <i className="ti ti-x" /> on a row to tuck it away.
              </p>
              {(dismissedDepartmentOutcomes.length > 0 || showDismissed) && (
                <div className={styles.deptOutcomesToggle}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setShowDismissed((v) => !v)}
                  >
                    {showDismissed
                      ? "Back to list"
                      : `Show removed (${dismissedDepartmentOutcomes.length})`}
                  </button>
                  {showDismissed && dismissedDepartmentOutcomes.length > 0 && (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={restoreAllOutcomes}
                    >
                      Restore all
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.filterChips}>
              {DEPARTMENT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${styles.filterChip} ${
                    departmentFilter === f.key ? styles.filterChipActive : ""
                  }`}
                  onClick={() => setDepartmentFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {loadingDepartment ? (
              <p className={styles.empty}>Loading…</p>
            ) : filteredDepartmentOutcomes.length === 0 ? (
              <p className={styles.empty}>
                {showDismissed
                  ? "Nothing removed."
                  : departmentFilter === "ALL"
                    ? "No decided requests in your department yet."
                    : "Nothing here yet."}
              </p>
            ) : (
              <div className={styles.list}>
                {filteredDepartmentOutcomes.map((l) => (
                  <DepartmentOutcomeRow
                    key={l.id}
                    leave={l}
                    dismissed={showDismissed}
                    onToggleDismiss={
                      showDismissed ? restoreOutcome : dismissOutcome
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
