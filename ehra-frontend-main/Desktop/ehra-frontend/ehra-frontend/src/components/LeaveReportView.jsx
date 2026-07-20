import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLeaveReport,
  downloadLeaveCsv,
  downloadLeavePdf,
} from "../api/reportsApi";
import ReportDropdown from "./ReportDropdown";
import ReportDateRangePicker from "./ReportDateRangePicker";
import styles from "./ReportsTab.module.css";

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function presetRange(preset) {
  const today = new Date();
  switch (preset) {
    case "thisMonth":
      return { from: iso(startOfMonth(today)), to: iso(today) };
    case "lastMonth": {
      const lastMonthDate = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      return {
        from: iso(startOfMonth(lastMonthDate)),
        to: iso(endOfMonth(lastMonthDate)),
      };
    }
    case "thisQuarter":
      return { from: iso(startOfQuarter(today)), to: iso(today) };
    case "last90":
      return {
        from: iso(new Date(today.getTime() - 89 * 86400000)),
        to: iso(today),
      };
    default:
      return { from: iso(startOfQuarter(today)), to: iso(today) };
  }
}

function formatDateFull(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMonthLabel(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function fmtHours(v) {
  if (v === null || v === undefined) return "—";
  if (v < 48) return `${v} hrs`;
  return `${Math.round((v / 24) * 10) / 10} days`;
}

function fmtDelta(v, { invertColor = false, suffix = "" } = {}) {
  if (v === null || v === undefined) return null;
  if (v === 0) return { text: "No change vs prior period", cls: "neutral" };
  const sign = v > 0 ? "+" : "";
  const isGood = invertColor ? v < 0 : v > 0;
  return {
    text: `${sign}${v}${suffix} vs prior period`,
    cls: isGood ? "up" : "down",
  };
}

function leaveTypeLabel(t) {
  if (!t) return "—";
  return t
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function StackedTrendChart({ trend }) {
  if (!trend || trend.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        No leave requests in this period yet.
      </div>
    );
  }

  const width = 100;
  const height = 42;
  const barGap = trend.length > 16 ? 0.8 : 1.6;
  const barWidth = width / trend.length - barGap;
  const maxTotal = Math.max(...trend.map((t) => t.totalCount), 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 10}`}
      className={styles.chartSvg}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke="#e8edeb"
        strokeWidth="0.3"
      />
      {trend.map((t, i) => {
        const x = i * (barWidth + barGap);
        const segments = [
          { count: t.approvedCount, color: "#0f6e56" },
          { count: t.pendingCount, color: "#e5a339" },
          { count: t.rejectedCount, color: "#c0392b" },
          { count: t.cancelledCount, color: "#9aa8a3" },
        ];
        let yCursor = height;
        return (
          <g key={i}>
            {t.totalCount === 0 ? (
              <rect
                x={x}
                y={height - 0.5}
                width={Math.max(barWidth, 0.5)}
                height={0.5}
                fill="#e8edeb"
              />
            ) : (
              segments.map((seg, si) => {
                if (seg.count === 0) return null;
                const h = (seg.count / maxTotal) * height;
                yCursor -= h;
                return (
                  <rect
                    key={si}
                    x={x}
                    y={yCursor}
                    width={Math.max(barWidth, 0.5)}
                    height={h}
                    fill={seg.color}
                  >
                    <title>
                      {`${formatMonthLabel(t.periodStart)}: ${t.totalCount} requests`}
                    </title>
                  </rect>
                );
              })
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function LeaveReportView({ departments = [] }) {
  const navigate = useNavigate();

  const [preset, setPreset] = useState("thisQuarter");
  const initialRange = presetRange("thisQuarter");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [departmentId, setDepartmentId] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const applyPreset = (p) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const fetchReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await getLeaveReport(
        from,
        to,
        departmentId || undefined,
      );
      setReport(data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Couldn't load the leave report.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportError("");
    try {
      await downloadLeaveCsv(from, to, departmentId || undefined);
    } catch {
      setExportError("Couldn't generate the CSV export.");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setExportError("");
    try {
      await downloadLeavePdf(from, to, departmentId || undefined);
    } catch {
      setExportError("Couldn't generate the PDF export.");
    } finally {
      setExportingPdf(false);
    }
  };

  const requestsDelta = report ? fmtDelta(report.totalRequestsDelta) : null;
  const rejectedDelta = report
    ? fmtDelta(report.totalRejectedDelta, { invertColor: true })
    : null;
  const turnaroundDelta = report
    ? fmtDelta(report.avgApprovalTurnaroundDeltaHours, {
        invertColor: true,
        suffix: " hrs",
      })
    : null;

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Leave</h2>
          <p className={styles.subheading}>
            Requests, approvals, and who's out right now.
          </p>
        </div>
        <div className={styles.exportBtns}>
          <button
            className={styles.exportBtn}
            onClick={handleExportCsv}
            disabled={exportingCsv || loading}
          >
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            {exportingCsv ? "Preparing…" : "Export CSV"}
          </button>
          <button
            className={styles.exportBtnPrimary}
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
          >
            <i className="ti ti-file-type-pdf" aria-hidden="true" />
            {exportingPdf ? "Preparing…" : "Export PDF"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {exportError}
        </div>
      )}

      {/* ── Filters ── */}
      <div className={styles.filterBar}>
        <div className={styles.presetGroup}>
          {[
            { key: "thisMonth", label: "This month" },
            { key: "lastMonth", label: "Last month" },
            { key: "thisQuarter", label: "This quarter" },
            { key: "last90", label: "Last 90 days" },
            { key: "custom", label: "Custom" },
          ].map((p) => (
            <button
              key={p.key}
              className={`${styles.presetBtn} ${preset === p.key ? styles.presetActive : ""}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <ReportDateRangePicker
            from={from}
            to={to}
            onApply={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
        )}

        <ReportDropdown
          icon="ti-building"
          className={styles.deptDropdownSlot}
          value={departmentId}
          onChange={setDepartmentId}
          options={[
            { value: "", label: "All departments" },
            ...departments.map((d) => ({
              value: String(d.id),
              label: d.name,
            })),
          ]}
        />
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
        </div>
      ) : report ? (
        <>
          <p className={styles.periodLine}>
            {formatDateFull(report.from)} – {formatDateFull(report.to)}
            {report.departmentName
              ? ` · ${report.departmentName}`
              : " · All departments"}{" "}
            · requests counted by submission date
          </p>

          {/* ── Summary cards ── */}
          <div className={styles.cardsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total requests</span>
              <span className={styles.statValue}>{report.totalRequests}</span>
              {requestsDelta && (
                <span className={styles[`delta_${requestsDelta.cls}`]}>
                  {requestsDelta.text}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Approved</span>
              <span className={styles.statValue}>{report.totalApproved}</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardWarn}`}>
              <span className={styles.statLabel}>Pending</span>
              <span className={styles.statValue}>{report.totalPending}</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardBad}`}>
              <span className={styles.statLabel}>Rejected</span>
              <span className={styles.statValue}>{report.totalRejected}</span>
              {rejectedDelta && (
                <span className={styles[`delta_${rejectedDelta.cls}`]}>
                  {rejectedDelta.text}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Avg approval turnaround</span>
              <span className={styles.statValue}>
                {fmtHours(report.avgApprovalTurnaroundHours)}
              </span>
              {turnaroundDelta && (
                <span className={styles[`delta_${turnaroundDelta.cls}`]}>
                  {turnaroundDelta.text}
                </span>
              )}
            </div>
          </div>

          {/* ── Trend chart ── */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeadRow}>
              <h3 className={styles.sectionTitle}>
                Requests by status, over time
              </h3>
              <div className={styles.legend}>
                <span>
                  <i className={styles.dotGood} /> Approved
                </span>
                <span>
                  <i className={styles.dotMid} /> Pending
                </span>
                <span>
                  <i className={styles.dotBad} /> Rejected
                </span>
              </div>
            </div>
            <StackedTrendChart trend={report.trend} />
          </div>

          {/* ── By type & status ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>By leave type</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Rejected</th>
                    <th>Cancelled</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.typeStatusBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.empty}>
                          <i
                            className="ti ti-calendar-off"
                            style={{ fontSize: 26 }}
                            aria-hidden="true"
                          />
                          <p>No leave requests in this period yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    report.typeStatusBreakdown.map((r) => (
                      <tr key={r.leaveType}>
                        <td className={styles.empName}>
                          {leaveTypeLabel(r.leaveType)}
                        </td>
                        <td data-label="Approved">{r.approvedCount}</td>
                        <td data-label="Pending">{r.pendingCount}</td>
                        <td
                          data-label="Rejected"
                          className={
                            r.rejectedCount > 0 ? styles.badText : undefined
                          }
                        >
                          {r.rejectedCount}
                        </td>
                        <td data-label="Cancelled">{r.cancelledCount}</td>
                        <td data-label="Total">{r.totalCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Currently on leave ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              Currently on leave
              {report.departmentName ? ` · ${report.departmentName}` : ""}
            </h3>
            {report.currentlyOnLeave.length === 0 ? (
              <div className={styles.empty}>
                <i
                  className="ti ti-beach"
                  style={{ fontSize: 26 }}
                  aria-hidden="true"
                />
                <p>Nobody is on approved leave today.</p>
              </div>
            ) : (
              <div className={styles.onLeaveGrid}>
                {report.currentlyOnLeave.map((r) => (
                  <div
                    key={r.employeeId}
                    className={styles.onLeaveCard}
                    onClick={() =>
                      navigate(`/employees/${r.employeeId}`, {
                        state: { from: "Reports" },
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className={styles.onLeaveCardTop}>
                      <div className={styles.avatar}>
                        {initials(r.firstName, r.lastName)}
                      </div>
                      <div>
                        <div className={styles.empName}>
                          {r.firstName} {r.lastName}
                        </div>
                        <div className={styles.onLeaveMeta}>
                          {r.departmentName} · {leaveTypeLabel(r.leaveType)}
                        </div>
                      </div>
                    </div>
                    <div className={styles.onLeaveMeta}>
                      {formatDateShort(r.startDate)} –{" "}
                      {formatDateShort(r.endDate)}
                    </div>
                    <div className={styles.onLeaveDaysLeft}>
                      {r.daysRemaining <= 0
                        ? "Returning today"
                        : `${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"} left`}
                    </div>
                    {r.coverPersonFirstName && (
                      <div className={styles.onLeaveMeta}>
                        Covered by {r.coverPersonFirstName}{" "}
                        {r.coverPersonLastName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
