import { useState, useEffect, useCallback } from "react";
import {
  getAttendanceReport,
  getPayrollReport,
  getLeaveReport,
  getDepartmentHealthReport,
  getWorkforceReport,
} from "../api/reportsApi";
import styles from "./ReportsSummaryModal.module.css";

// ── Date helpers (mirrors the defaults each report tab opens with, so this
// summary matches what an employer would see if they opened every tab) ──
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtMonth(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
function pct(v) {
  return v === null || v === undefined ? "—" : `${v}%`;
}
function num(v) {
  return v === null || v === undefined ? "—" : v;
}
function money(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function delta(v, suffix = "") {
  if (v === null || v === undefined) return "no prior data";
  if (v === 0) return "no change";
  return `${v > 0 ? "+" : ""}${v}${suffix} vs prior period`;
}
function titleCase(s) {
  if (!s) return "—";
  return String(s)
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
function fullName(first, last) {
  return [first, last].filter(Boolean).join(" ") || "—";
}
function line(label, value) {
  return `${label}: ${value}`;
}

// Builds the entire report-tab summary as one plain text block — headings
// plus label/value lines and simple "- " list rows. No charts, tables,
// colors, or badges — just text and numbers, so it can be read, copied, or
// pasted anywhere.
function buildSummaryText({
  attendance,
  payroll,
  leave,
  deptHealth,
  workforce,
}) {
  const out = [];
  const rule = "――――――――――――――――――――――――――――――――――――――――――――――――――――――";

  out.push(`FULL REPORTS SUMMARY`);
  out.push(`Generated: ${new Date().toLocaleString()}`);
  out.push("");

  // ── Attendance & Punctuality ──
  out.push(rule);
  out.push(
    `ATTENDANCE & PUNCTUALITY  (${fmtDate(attendance.from)} – ${fmtDate(attendance.to)}` +
      `${attendance.departmentName ? `, ${attendance.departmentName}` : ", all departments"})`,
  );
  out.push(rule);
  out.push(
    line(
      "Attendance rate",
      `${pct(attendance.attendanceRatePercent)} (prior: ${pct(attendance.previousAttendanceRatePercent)}, ${delta(attendance.attendanceRateDeltaPercent, " pts")})`,
    ),
  );
  out.push(
    line(
      "Present / Late / Early leave / Absent / Total marked",
      `${num(attendance.totalPresent)} / ${num(attendance.totalLate)} (${delta(attendance.lateDelta)}) / ${num(attendance.totalEarlyLeave)} (${delta(attendance.earlyLeaveDelta)}) / ${num(attendance.totalAbsent)} (${delta(attendance.absentDelta)}) / ${num(attendance.totalMarked)}`,
    ),
  );
  out.push("");
  out.push("By department:");
  if (!attendance.departmentBreakdown?.length) {
    out.push("  (no departments in range)");
  } else {
    attendance.departmentBreakdown.forEach((d) => {
      out.push(
        `  - ${d.departmentName}: ${d.employeeCount} employees, rate ${pct(d.attendanceRatePercent)}, present ${d.presentCount}, late ${d.lateCount}, early ${d.earlyLeaveCount}, absent ${d.absentCount}`,
      );
    });
  }
  out.push("");
  out.push("By employee:");
  if (!attendance.employees?.length) {
    out.push("  (no employees in range)");
  } else {
    attendance.employees.forEach((e) => {
      out.push(
        `  - ${fullName(e.firstName, e.lastName)} (${e.departmentName}): present ${e.presentCount}, late ${e.lateCount}, early ${e.earlyLeaveCount}, absent ${e.absentCount}, rate ${pct(e.attendanceRatePercent)}`,
      );
    });
  }
  out.push("");

  // ── Payroll & Penalty ──
  out.push(rule);
  out.push(
    `PAYROLL & PENALTY  (last ${payroll.periodsRequested} periods, ${payroll.periodsFound} found` +
      `${payroll.departmentName ? `, ${payroll.departmentName}` : ", all departments"})`,
  );
  out.push(rule);
  out.push(
    line(
      "Total deduction",
      `${money(payroll.totalDeduction)} (${delta(payroll.totalDeductionDelta)})`,
    ),
  );
  out.push(line("Total net pay", money(payroll.totalNetPay)));
  out.push(
    line(
      "Pardon rate",
      `${pct(payroll.pardonRatePercent)} (${delta(payroll.pardonRateDeltaPercent, " pts")})`,
    ),
  );
  out.push(
    line(
      "Late / Early leave / Absent / Pardoned / Excused by leave",
      `${num(payroll.totalLate)} / ${num(payroll.totalEarlyLeave)} / ${num(payroll.totalAbsent)} / ${num(payroll.totalPardoned)} / ${num(payroll.totalExcusedByLeave)}`,
    ),
  );
  out.push("");
  out.push("By pay period:");
  if (!payroll.periods?.length) {
    out.push("  (no finalized pay periods yet)");
  } else {
    payroll.periods.forEach((p) => {
      out.push(
        `  - Period ending ${fmtDate(p.periodEnd)}: deduction ${money(p.totalDeduction)}, net pay ${money(p.totalNetPay)}, late ${p.lateCount}, early ${p.earlyLeaveCount}, absent ${p.absentCount}, pardoned ${p.pardonedCount}`,
      );
    });
  }
  out.push("");
  out.push("By department:");
  if (!payroll.departmentBreakdown?.length) {
    out.push("  (no departments in range)");
  } else {
    payroll.departmentBreakdown.forEach((d) => {
      out.push(
        `  - ${d.departmentName}: ${d.employeeCount} employees, deduction ${money(d.totalDeduction)}, net pay ${money(d.totalNetPay)}, pardon rate ${pct(d.pardonRatePercent)}`,
      );
    });
  }
  out.push("");
  out.push("By employee:");
  if (!payroll.employees?.length) {
    out.push("  (no employees in range)");
  } else {
    payroll.employees.forEach((e) => {
      out.push(
        `  - ${fullName(e.firstName, e.lastName)} (${e.departmentName}): deduction ${money(e.totalDeduction)}, net pay ${money(e.totalNetPay)}, late ${e.lateCount}, early ${e.earlyLeaveCount}, absent ${e.absentCount}, pardoned ${e.pardonedCount}, pardon rate ${pct(e.pardonRatePercent)}`,
      );
    });
  }
  out.push("");

  // ── Leave ──
  out.push(rule);
  out.push(
    `LEAVE  (${fmtDate(leave.from)} – ${fmtDate(leave.to)}` +
      `${leave.departmentName ? `, ${leave.departmentName}` : ", all departments"})`,
  );
  out.push(rule);
  out.push(
    line(
      "Total requests / Approved / Pending / Rejected / Cancelled",
      `${num(leave.totalRequests)} (${delta(leave.totalRequestsDelta)}) / ${num(leave.totalApproved)} (${delta(leave.totalApprovedDelta)}) / ${num(leave.totalPending)} / ${num(leave.totalRejected)} (${delta(leave.totalRejectedDelta)}) / ${num(leave.totalCancelled)}`,
    ),
  );
  out.push(
    line(
      "Avg approval turnaround",
      `${leave.avgApprovalTurnaroundHours ?? "—"} hrs across ${leave.decidedCount} decided (${delta(leave.avgApprovalTurnaroundDeltaHours, " hrs")})`,
    ),
  );
  out.push("");
  out.push("By leave type:");
  if (!leave.typeStatusBreakdown?.length) {
    out.push("  (no requests in range)");
  } else {
    leave.typeStatusBreakdown.forEach((t) => {
      out.push(
        `  - ${titleCase(t.leaveType)}: approved ${t.approvedCount}, pending ${t.pendingCount}, rejected ${t.rejectedCount}, cancelled ${t.cancelledCount}, total ${t.totalCount}`,
      );
    });
  }
  out.push("");
  out.push("Currently on leave (today):");
  if (!leave.currentlyOnLeave?.length) {
    out.push("  Nobody is on approved leave today.");
  } else {
    leave.currentlyOnLeave.forEach((r) => {
      out.push(
        `  - ${fullName(r.firstName, r.lastName)} (${r.departmentName}): ${titleCase(r.leaveType)}, ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}, ${r.daysRemaining} day(s) remaining` +
          (r.coverPersonFirstName
            ? `, covered by ${fullName(r.coverPersonFirstName, r.coverPersonLastName)}`
            : ""),
      );
    });
  }
  out.push("");

  // ── Department Health ──
  out.push(rule);
  out.push(`DEPARTMENT HEALTH  (as of ${fmtDate(deptHealth.asOf)})`);
  out.push(rule);
  out.push(
    line(
      "Departments / Total headcount",
      `${num(deptHealth.totalDepartments)} / ${num(deptHealth.totalHeadcount)}`,
    ),
  );
  out.push(
    line(
      "Pending leave approvals / Pending profile-edit approvals",
      `${num(deptHealth.totalPendingLeaveApprovals)} / ${num(deptHealth.totalPendingProfileEditApprovals)}`,
    ),
  );
  out.push(
    line(
      "Total deductions (latest finalized period" +
        (deptHealth.payrollPeriodEnd
          ? ` ending ${fmtDate(deptHealth.payrollPeriodEnd)}`
          : "") +
        ")",
      money(deptHealth.totalDeduction),
    ),
  );
  out.push("");
  out.push("By department:");
  if (!deptHealth.rows?.length) {
    out.push("  (no departments yet)");
  } else {
    deptHealth.rows.forEach((d) => {
      out.push(
        `  - ${d.departmentName}: headcount ${d.headcount}, attendance rate ${pct(d.attendanceRatePercent)}, deduction ${money(d.deductionTotal)}, pending leave ${d.pendingLeaveApprovals}, pending profile-edit ${d.pendingProfileEditApprovals}`,
      );
    });
  }
  out.push("");

  // ── Workforce Overview ──
  out.push(rule);
  out.push(
    `WORKFORCE OVERVIEW  (as of ${fmtDate(workforce.asOf)}, trend ${fmtDate(workforce.trendFrom)} – ${fmtDate(workforce.trendTo)}, ${workforce.trendMonths} months)`,
  );
  out.push(rule);
  out.push(
    line(
      "Total headcount / Departments / Departments without a HOD",
      `${num(workforce.totalHeadcount)} / ${num(workforce.totalDepartments)} / ${num(workforce.departmentsWithoutHodCount)}`,
    ),
  );
  out.push(
    line(
      "Hires / Departures in trend window",
      `${num(workforce.totalHiresInTrend)} / ${num(workforce.totalDeparturesInTrend)}`,
    ),
  );
  out.push("");
  out.push("Monthly trend:");
  (workforce.trend || []).forEach((t) => {
    out.push(
      `  - ${fmtMonth(t.periodStart)}: hires ${t.hires}, departures ${t.departures}, net ${t.netChange > 0 ? "+" : ""}${t.netChange}, headcount at month end ${t.headcountAtMonthEnd}`,
    );
  });
  out.push("");
  out.push("By department:");
  if (!workforce.departmentBreakdown?.length) {
    out.push("  (no departments yet)");
  } else {
    workforce.departmentBreakdown.forEach((d) => {
      out.push(
        `  - ${d.departmentName}: headcount ${d.headcount}, active ${d.activeCount}, pending ${d.pendingApprovalCount}, suspended ${d.suspendedCount}, full-time ${d.fullTimeCount}, part-time ${d.partTimeCount}, HOD: ${d.hasHod ? d.hodName : "Vacant"}`,
      );
    });
  }
  out.push("");
  out.push("By status:");
  (workforce.statusBreakdown || []).forEach((s) => {
    out.push(`  - ${titleCase(s.status)}: ${s.count}`);
  });
  out.push("");
  out.push("By employment type:");
  (workforce.employmentTypeBreakdown || []).forEach((t) => {
    out.push(`  - ${titleCase(t.employmentType)}: ${t.count}`);
  });
  out.push("");
  out.push("Departments without a HOD:");
  if (!workforce.departmentsWithoutHod?.length) {
    out.push("  None — every department has a HOD assigned.");
  } else {
    workforce.departmentsWithoutHod.forEach((n) => out.push(`  - ${n}`));
  }

  return out.join("\n");
}

export default function ReportsSummaryModal({ open, onClose }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const today = new Date();
      const attFrom = iso(startOfMonth(today));
      const leaveFrom = iso(startOfQuarter(today));
      const to = iso(today);

      const [attRes, payRes, leaveRes, deptRes, workRes] = await Promise.all([
        getAttendanceReport(attFrom, to, undefined),
        getPayrollReport(undefined, undefined),
        getLeaveReport(leaveFrom, to, undefined),
        getDepartmentHealthReport(),
        getWorkforceReport(),
      ]);

      setText(
        buildSummaryText({
          attendance: attRes.data,
          payroll: payRes.data,
          leave: leaveRes.data,
          deptHealth: deptRes.data,
          workforce: workRes.data,
        }),
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't load the full reports summary.",
      );
      setText("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore, the text is still
      // visible and selectable in the modal.
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <i className="ti ti-report" />
            </div>
            <div>
              <h3 className={styles.headerTitle}>Full reports summary</h3>
              <p className={styles.headerSub}>
                Every report tab, summarized in plain text and numbers
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : error ? (
            <div className={styles.errorBox}>
              <i className="ti ti-alert-circle" /> {error}
            </div>
          ) : (
            <pre className={styles.summaryPre}>{text}</pre>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Close
          </button>
          <button
            className={styles.copyBtn}
            onClick={handleCopy}
            disabled={loading || !!error || !text}
            type="button"
          >
            <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} />
            {copied ? "Copied!" : "Copy summary"}
          </button>
        </div>
      </div>
    </div>
  );
}
