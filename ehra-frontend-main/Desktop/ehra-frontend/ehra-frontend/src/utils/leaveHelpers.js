// Shared display helpers for the leave workflow — kept in one place so the
// employee, HOD, and employer views never drift out of sync with each
// other or with the backend's LeaveType / LeaveStatus enums.

// Matches com.Ehra.Enums.LeaveType exactly.
export const LEAVE_TYPE_LABEL = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  COMPASSIONATE: "Compassionate Leave",
  BEREAVEMENT: "Bereavement Leave",
  STUDY: "Study Leave",
  UNPAID: "Unpaid Leave",
  EMERGENCY: "Emergency Leave",
  MARRIAGE: "Marriage Leave",
  SABBATICAL: "Sabbatical Leave",
  PUBLIC_HOLIDAY_LIEU: "Public Holiday (in lieu)",
};

export const LEAVE_TYPE_ICON = {
  ANNUAL: "ti-beach",
  SICK: "ti-vaccine",
  MATERNITY: "ti-baby-carriage",
  PATERNITY: "ti-baby-carriage",
  COMPASSIONATE: "ti-heart-handshake",
  BEREAVEMENT: "ti-flower",
  STUDY: "ti-school",
  UNPAID: "ti-cash-off",
  EMERGENCY: "ti-alert-triangle",
  MARRIAGE: "ti-rings",
  SABBATICAL: "ti-hourglass",
  PUBLIC_HOLIDAY_LIEU: "ti-calendar-star",
};

export function leaveTypeLabel(type) {
  return LEAVE_TYPE_LABEL[type] || type;
}

// Matches com.Ehra.Enums.LeaveStatus exactly.
export const LEAVE_STATUS_CONFIG = {
  PENDING_COVER: {
    label: "Awaiting cover",
    bg: "#faeeda",
    color: "#633806",
    icon: "ti-user-question",
  },
  COVER_DECLINED: {
    label: "Cover declined",
    bg: "#fdeceb",
    color: "#c0392b",
    icon: "ti-user-x",
  },
  PENDING_HOD: {
    label: "Awaiting HOD",
    bg: "#faeeda",
    color: "#633806",
    icon: "ti-clock",
  },
  PENDING_EMPLOYER: {
    label: "Awaiting employer",
    bg: "#faeeda",
    color: "#633806",
    icon: "ti-clock",
  },
  APPROVED: {
    label: "Approved",
    bg: "#dff3ea",
    color: "#0f6e56",
    icon: "ti-circle-check",
  },
  REJECTED: {
    label: "Rejected",
    bg: "#fdeceb",
    color: "#c0392b",
    icon: "ti-circle-x",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "#eef0ef",
    color: "#666",
    icon: "ti-circle-minus",
  },
};

export function leaveStatusConfig(status) {
  return (
    LEAVE_STATUS_CONFIG[status] || {
      label: status,
      bg: "#eef0ef",
      color: "#666",
      icon: "ti-help-circle",
    }
  );
}

// A short, plain-language description of which stage a request is at,
// for use under a status pill so the chain is legible without reading
// the whole detail card.
//
// Carries the cover-person outcome forward at every later stage — not
// just the moment it happens. Previously this only described whichever
// single stage the request currently sat at, so as soon as a request
// moved past PENDING_HOD (e.g. HOD was skipped and it went straight to
// PENDING_EMPLOYER, or it later reached APPROVED), any mention that a
// cover person had accepted disappeared from this line entirely — the
// only place that fact still showed up was buried in the full timeline.
export function leaveStageDescription(leave) {
  const hasCover = !!leave.coverPersonFirstName;
  const coverName = hasCover
    ? `${leave.coverPersonFirstName} ${leave.coverPersonLastName || ""}`.trim()
    : "";

  switch (leave.status) {
    case "PENDING_COVER":
      return hasCover
        ? `Waiting for ${coverName} to accept covering this leave.`
        : "Waiting for the nominated cover person to respond.";
    case "COVER_DECLINED":
      return `${coverName} declined to cover this leave. Choose someone else to continue.`;
    case "PENDING_HOD":
      return hasCover
        ? `${coverName} accepted to cover — now waiting on the Head of Department.`
        : "Waiting on the Head of Department.";
    case "PENDING_EMPLOYER": {
      const coverPart = hasCover ? `${coverName} accepted to cover. ` : "";
      const nextPart = leave.hodDecidedById
        ? "HOD approved — awaiting final employer sign-off."
        : "Awaiting the employer's decision.";
      return `${coverPart}${nextPart}`;
    }
    case "APPROVED": {
      const coverPart = hasCover
        ? ` ${coverName} is confirmed as cover.`
        : "";
      return `Approved — leave is confirmed.${coverPart}`;
    }
    case "REJECTED":
      return "This leave request was rejected.";
    case "CANCELLED":
      return "This request was cancelled.";
    default:
      return "";
  }
}

// Statuses that mean the request is still moving through the approval
// chain (shown in the "Processing" section of the employee leave tab).
export const PROCESSING_STATUSES = [
  "PENDING_COVER",
  "COVER_DECLINED",
  "PENDING_HOD",
  "PENDING_EMPLOYER",
];

// Statuses that mean the request has been fully decided one way or
// another (shown in the "History" section).
export const HISTORY_STATUSES = ["APPROVED", "REJECTED", "CANCELLED"];

// Builds the ordered stage list for the visual stepper on a processing
// card. Cover is only included when a cover person was actually
// nominated (it's optional per LeavePolicy). HOD is skipped only when we
// have positive evidence the request went straight from request/cover to
// the employer with no HOD decision recorded — otherwise we assume it's
// still to come, since we can't see the department's policy from here.
export function leaveSteps(leave) {
  const hasCover = !!leave.coverPersonFirstName;
  // Was HOD ever part of this chain? Positive evidence it was skipped is:
  // the request has moved past cover (or never had one) and past HOD
  // (never sat in PENDING_HOD) with no HOD decision recorded. This must
  // hold for *any* later status — PENDING_EMPLOYER, APPROVED, or
  // REJECTED — not just PENDING_EMPLOYER, or a since-decided request that
  // skipped HOD would wrongly grow an HOD step once it's approved/rejected.
  const skippedHod =
    leave.status !== "PENDING_COVER" &&
    leave.status !== "COVER_DECLINED" &&
    leave.status !== "PENDING_HOD" &&
    leave.hodDecidedById == null;

  const steps = [{ key: "requested", label: "Requested", state: "done" }];

  if (hasCover) {
    let state = "done";
    if (leave.status === "PENDING_COVER") state = "current";
    else if (leave.status === "COVER_DECLINED") state = "declined";
    steps.push({ key: "cover", label: "Cover", state });
  }

  if (!skippedHod) {
    let state = "pending";
    if (leave.status === "PENDING_HOD") state = "current";
    else if (leave.hodDecidedById != null) state = "done";
    steps.push({ key: "hod", label: "HOD", state });
  }

  let employerState = "pending";
  if (leave.status === "PENDING_EMPLOYER") employerState = "current";
  else if (leave.status === "APPROVED" || leave.status === "REJECTED")
    employerState = "done";
  steps.push({ key: "employer", label: "Sign-off", state: employerState });

  return steps;
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Same idea as formatDate, but for LocalDateTime fields (cover response,
// HOD decision, employer decision) where the time-of-day is worth showing.
function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Builds the full, detailed timeline for a leave request — one entry per
// stage of the chain (Requested → Cover → HOD → Employer), each carrying
// who acted, what they decided, any note they left, and when. This is the
// data behind the "detailed process" view on both the Processing and
// History tabs: the horizontal StageTrack/leaveSteps() only drives the dot
// tracker (state per stage), but doesn't surface *who* approved/rejected
// or *what note* they left — this does.
//
// Mirrors the same "is HOD in the chain at all" logic as leaveSteps() so
// the two never disagree about which stages exist for a given request.
export function leaveTimeline(leave) {
  const hasCover = !!leave.coverPersonFirstName;
  const coverName = hasCover
    ? `${leave.coverPersonFirstName} ${leave.coverPersonLastName || ""}`.trim()
    : "";
  const hodName = leave.hodDecidedById ? leave.hodDecidedByName : "";

  // Once the request has moved past the cover stage without ever being
  // pending on an HOD (and none has decided), we know HOD was never part
  // of this chain — same rule leaveSteps() uses.
  const skippedHod =
    leave.status !== "PENDING_COVER" &&
    leave.status !== "COVER_DECLINED" &&
    leave.status !== "PENDING_HOD" &&
    leave.hodDecidedById == null;

  const entries = [
    {
      key: "requested",
      label: "Requested",
      icon: "ti-calendar-plus",
      state: "done",
      timestamp: leave.createdAt ? formatDateTime(leave.createdAt) : null,
      detail: `Submitted a ${leave.days}-day ${leaveTypeLabel(leave.leaveType || "").toLowerCase()} request${
        leave.reason ? ` — "${leave.reason}"` : ""
      }.`,
    },
  ];

  if (hasCover) {
    let state = "done";
    let detail = "";
    if (leave.status === "PENDING_COVER") {
      state = "current";
      detail = `Waiting for ${coverName} to accept or decline.`;
    } else if (leave.status === "COVER_DECLINED") {
      state = "declined";
      detail = `${coverName} declined to cover.${leave.coverNote ? ` Note: "${leave.coverNote}"` : ""}`;
    } else {
      state = "done";
      detail = `${coverName} accepted to cover this leave.${leave.coverNote ? ` Note: "${leave.coverNote}"` : ""}`;
    }
    entries.push({
      key: "cover",
      label: "Cover person",
      icon: "ti-user-shield",
      state,
      timestamp: leave.coverRespondedAt ? formatDateTime(leave.coverRespondedAt) : null,
      detail,
    });
  }

  if (!skippedHod) {
    let state = "pending";
    let detail = "Not yet reached.";
    if (leave.status === "PENDING_HOD") {
      state = "current";
      detail = "Waiting for the Head of Department to decide.";
    } else if (leave.hodDecidedById != null) {
      state = leave.hodApproved ? "done" : "declined";
      detail = `${hodName} ${leave.hodApproved ? "approved" : "rejected"} this request.${
        leave.hodNote ? ` Note: "${leave.hodNote}"` : ""
      }`;
    }
    entries.push({
      key: "hod",
      label: "Head of Department",
      icon: "ti-shield-check",
      state,
      timestamp: leave.hodDecidedAt ? formatDateTime(leave.hodDecidedAt) : null,
      detail,
    });
  }

  {
    // A REJECTED status can come from either the HOD or the employer —
    // the request never reaches PENDING_EMPLOYER if the HOD rejects it,
    // so the employer never actually made a decision in that case. Only
    // credit/blame the employer here when they were the one who decided:
    // APPROVED always means the employer decided (HOD can only advance a
    // request, never approve it outright); REJECTED means the employer
    // decided only when it wasn't already rejected by the HOD.
    const hodRejected = leave.hodDecidedById != null && leave.hodApproved === false;
    const employerActuallyDecided =
      leave.status === "APPROVED" || (leave.status === "REJECTED" && !hodRejected);

    let state = "pending";
    let detail = "Not yet reached.";
    if (leave.status === "PENDING_EMPLOYER") {
      state = "current";
      detail = "Awaiting the employer's final decision.";
    } else if (employerActuallyDecided) {
      state = leave.status === "APPROVED" ? "done" : "declined";
      detail = `Employer ${leave.status === "APPROVED" ? "approved" : "rejected"} this request.${
        leave.adminNote ? ` Note: "${leave.adminNote}"` : ""
      }`;
    } else if (leave.status === "REJECTED" && hodRejected) {
      detail = "Never reached — rejected earlier by the Head of Department.";
    }
    entries.push({
      key: "employer",
      label: "Employer",
      icon: "ti-briefcase",
      state,
      timestamp: employerActuallyDecided && leave.decidedAt ? formatDateTime(leave.decidedAt) : null,
      detail,
    });
  }

  if (leave.status === "CANCELLED") {
    entries.push({
      key: "cancelled",
      label: "Cancelled",
      icon: "ti-circle-minus",
      state: "declined",
      timestamp: null,
      detail: "Cancelled by the employee before a final decision was made.",
    });
  }

  return entries;
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}