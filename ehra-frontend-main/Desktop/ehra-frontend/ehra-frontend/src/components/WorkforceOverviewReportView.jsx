import { useState, useEffect, useCallback } from "react";
import {
  getWorkforceReport,
  downloadWorkforceCsv,
  downloadWorkforcePdf,
} from "../api/reportsApi";
import styles from "./ReportsTab.module.css";

function fmtDateFull(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function statusLabel(s) {
  if (!s) return "—";
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function employmentTypeLabel(t) {
  if (!t) return "—";
  return t
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function statusPillClass(status) {
  switch (status) {
    case "ACTIVE":
      return styles.pillApproved;
    case "PENDING_APPROVAL":
      return styles.pillPending;
    case "SUSPENDED":
      return styles.pillRejected;
    default:
      return styles.pillCancelled;
  }
}

// Diverging bar chart: hires rise above the baseline, departures drop
// below it, so a glance shows whether a month grew or shrank the team.
function HiresDeparturesChart({ trend }) {
  if (!trend || trend.length === 0) {
    return <div className={styles.chartEmpty}>No workforce data yet.</div>;
  }

  const width = 100;
  const halfHeight = 21;
  const height = halfHeight * 2;
  const barGap = trend.length > 10 ? 1.2 : 2.2;
  const barWidth = width / trend.length - barGap;
  const maxVal = Math.max(
    ...trend.map((t) => Math.max(t.hires, t.departures)),
    1,
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 12}`}
      className={styles.chartSvg}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={halfHeight}
        x2={width}
        y2={halfHeight}
        stroke="#e8edeb"
        strokeWidth="0.3"
      />
      {trend.map((t, i) => {
        const x = i * (barWidth + barGap);
        const hireH = (t.hires / maxVal) * halfHeight;
        const depH = (t.departures / maxVal) * halfHeight;
        return (
          <g key={i}>
            <rect
              x={x}
              y={halfHeight - hireH}
              width={Math.max(barWidth, 0.5)}
              height={hireH}
              fill="#0f6e56"
            >
              <title>
                {`${formatMonthLabel(t.periodStart)}: ${t.hires} hire${t.hires === 1 ? "" : "s"}`}
              </title>
            </rect>
            <rect
              x={x}
              y={halfHeight}
              width={Math.max(barWidth, 0.5)}
              height={depH}
              fill="#c0392b"
            >
              <title>
                {`${formatMonthLabel(t.periodStart)}: ${t.departures} departure${t.departures === 1 ? "" : "s"}`}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

export default function WorkforceOverviewReportView() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getWorkforceReport();
      setReport(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't load the workforce overview report.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportError("");
    try {
      await downloadWorkforceCsv();
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
      await downloadWorkforcePdf();
    } catch {
      setExportError("Couldn't generate the PDF export.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Workforce Overview</h2>
          <p className={styles.subheading}>
            Headcount trend, department composition, and where the org has gaps.
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
            As of {fmtDateFull(report.asOf)} · trend covers{" "}
            {fmtDateFull(report.trendFrom)} – {fmtDateFull(report.trendTo)} (
            {report.trendMonths} months)
          </p>

          {/* ── Summary cards ── */}
          <div className={styles.cardsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total headcount</span>
              <span className={styles.statValue}>{report.totalHeadcount}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Hires (trend window)</span>
              <span className={styles.statValue}>
                {report.totalHiresInTrend}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>
                Departures (trend window)
              </span>
              <span className={styles.statValue}>
                {report.totalDeparturesInTrend}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Departments</span>
              <span className={styles.statValue}>
                {report.totalDepartments}
              </span>
            </div>
            <div
              className={`${styles.statCard} ${report.departmentsWithoutHodCount > 0 ? styles.statCardWarn : ""}`}
            >
              <span className={styles.statLabel}>Departments without HOD</span>
              <span className={styles.statValue}>
                {report.departmentsWithoutHodCount}
              </span>
            </div>
          </div>

          {/* ── Trend chart ── */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeadRow}>
              <h3 className={styles.sectionTitle}>Hires vs departures</h3>
              <div className={styles.legend}>
                <span>
                  <i className={styles.dotGood} /> Hires
                </span>
                <span>
                  <i className={styles.dotBad} /> Departures / removals
                </span>
              </div>
            </div>
            <HiresDeparturesChart trend={report.trend} />
            <div className={styles.tableWrap} style={{ marginTop: 10 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Hires</th>
                    <th>Departures</th>
                    <th>Net change</th>
                    <th>Headcount at month end</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trend.map((t) => (
                    <tr key={t.periodStart}>
                      <td className={styles.empName}>
                        {formatMonthLabel(t.periodStart)}
                      </td>
                      <td data-label="Hires">{t.hires}</td>
                      <td data-label="Departures">{t.departures}</td>
                      <td
                        data-label="Net change"
                        className={
                          t.netChange > 0
                            ? undefined
                            : t.netChange < 0
                              ? styles.badText
                              : undefined
                        }
                      >
                        {t.netChange > 0 ? `+${t.netChange}` : t.netChange}
                      </td>
                      <td data-label="Headcount at month end">
                        {t.headcountAtMonthEnd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── By department ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>By department</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Headcount</th>
                    <th>Active</th>
                    <th>Pending</th>
                    <th>Suspended</th>
                    <th>Full-time</th>
                    <th>Part-time</th>
                    <th>Head of Department</th>
                  </tr>
                </thead>
                <tbody>
                  {report.departmentBreakdown.map((d) => (
                    <tr key={d.departmentName}>
                      <td className={styles.empName}>{d.departmentName}</td>
                      <td data-label="Headcount">{d.headcount}</td>
                      <td data-label="Active">{d.activeCount}</td>
                      <td data-label="Pending">{d.pendingApprovalCount}</td>
                      <td data-label="Suspended">{d.suspendedCount}</td>
                      <td data-label="Full-time">{d.fullTimeCount}</td>
                      <td data-label="Part-time">{d.partTimeCount}</td>
                      <td data-label="Head of Department">
                        {d.hasHod ? (
                          d.hodName
                        ) : (
                          <span
                            className={`${styles.attentionBadge} ${styles.attentionMed}`}
                          >
                            <i className="ti ti-user-x" aria-hidden="true" />{" "}
                            Vacant
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Status & employment type ── */}
          <div className={styles.twoColGrid}>
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>By status</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.statusBreakdown.map((s) => (
                      <tr key={s.status}>
                        <td>
                          <span
                            className={`${styles.statusPill} ${statusPillClass(s.status)}`}
                          >
                            {statusLabel(s.status)}
                          </span>
                        </td>
                        <td data-label="Count">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>By employment type</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.employmentTypeBreakdown.map((t) => (
                      <tr key={t.employmentType}>
                        <td className={styles.empName}>
                          {employmentTypeLabel(t.employmentType)}
                        </td>
                        <td data-label="Count">{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Departments without a HOD ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Departments without a HOD</h3>
            {report.departmentsWithoutHod.length === 0 ? (
              <div className={styles.empty}>
                <i
                  className="ti ti-check"
                  style={{ fontSize: 26 }}
                  aria-hidden="true"
                />
                <p>Every department has a Head of Department assigned.</p>
              </div>
            ) : (
              <div className={styles.onLeaveGrid}>
                {report.departmentsWithoutHod.map((name) => (
                  <div
                    key={name}
                    className={`${styles.onLeaveCard} ${styles.vacancyCard}`}
                  >
                    <div className={styles.empName}>{name}</div>
                    <span
                      className={`${styles.attentionBadge} ${styles.attentionMed}`}
                    >
                      <i className="ti ti-user-x" aria-hidden="true" /> No HOD
                      assigned
                    </span>
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
