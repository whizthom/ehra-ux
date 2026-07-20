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
    bg: "var(--warning-bg)",
    color: "var(--warning-text)",
    icon: "ti-user-question",
  },
  COVER_DECLINED: {
    label: "Cover declined",
    bg: "var(--danger-bg)",
    color: "var(--danger-text)",
    icon: "ti-user-x",
  },
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
    label: "Approved",
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

export function leaveStatusConfig(status) {
  return (
    LEAVE_STATUS_CONFIG[status] || {
      label: status,
      bg: "var(--bg-surface-alt)",
      color: "var(--text-secondary)",
      icon: "ti-help-circle",
    }
  );
}

// A short, plain-language description of which stage a request is at,
// for use under a status pill so the chain is legible without reading
// the whole detail card.
export function leaveStageDescription(leave) {
  switch (leave.status) {
    case "PENDING_COVER":
      return leave.coverPersonFirstName
        ? `Waiting for ${leave.coverPersonFirstName} ${leave.coverPersonLastName || ""} to accept covering this leave.`
        : "Waiting for the nominated cover person to respond.";
    case "COVER_DECLINED":
      return "The cover person declined. Choose someone else to continue.";
    case "PENDING_HOD":
      return "Cover accepted — waiting on the Head of Department.";
    case "PENDING_EMPLOYER":
      return leave.hodDecidedById
        ? "HOD approved — waiting on final employer sign-off."
        : "Waiting on the employer's decision.";
    case "APPROVED":
      return "Approved — leave is confirmed.";
    case "REJECTED":
      return "This leave request was rejected.";
    case "CANCELLED":
      return "This request was cancelled.";
    default:
      return "";
  }
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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