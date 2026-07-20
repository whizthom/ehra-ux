import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPayrollReport,
  downloadPayrollCsv,
  downloadPayrollPdf,
} from "../api/reportsApi";
import ReportDropdown from "./ReportDropdown";
import styles from "./ReportsTab.module.css";

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtRate(v) {
  return v === null || v === undefined ? "—" : `${v}%`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// invertColor: for deductions, a drop is the good outcome. For pardon
// rate we don't color-code — a rising rate could mean healthy leniency
// or penalties set too aggressively, it's diagnostic rather than good/bad.
function fmtDelta(
  v,
  { invertColor = false, isMoney = false, suffix = "", neutral = false } = {},
) {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  if (num === 0) return { text: "No change vs prior period", cls: "neutral" };
  const sign = num > 0 ? "+" : "";
  const display = isMoney ? fmtMoney(Math.abs(num)) : Math.abs(num);
  const signedDisplay = `${sign}${num < 0 ? "-" : ""}${display}`;
  const cls = neutral
    ? "neutral"
    : (invertColor ? num < 0 : num > 0)
      ? "up"
      : "down";
  return {
    text: `${signedDisplay}${suffix} vs prior period`,
    cls,
  };
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

const SORT_FIELDS = {
  name: (r) => `${r.firstName} ${r.lastName || ""}`.toLowerCase(),
  department: (r) => (r.departmentName || "").toLowerCase(),
  absent: (r) => r.absentCount,
  deduction: (r) => Number(r.totalDeduction || 0),
  netPay: (r) =>
    r.totalNetPay === null || r.totalNetPay === undefined
      ? -1
      : Number(r.totalNetPay),
  pardonRate: (r) => (r.pardonRatePercent === null ? -1 : r.pardonRatePercent),
};

const PERIOD_OPTIONS = [
  { value: 3, label: "Last 3 periods" },
  { value: 6, label: "Last 6 periods" },
  { value: 12, label: "Last 12 periods" },
  { value: 24, label: "Last 24 periods" },
];

function DeductionTrendChart({ periods }) {
  if (!periods || periods.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        No finalized pay periods in this range yet.
      </div>
    );
  }

  const width = 100;
  const height = 42;
  const barGap = periods.length > 12 ? 0.6 : 1.4;
  const barWidth = width / periods.length - barGap;
  const maxDeduction = Math.max(
    ...periods.map((p) => Number(p.totalDeduction || 0)),
    0.01,
  );

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
      {periods.map((p, i) => {
        const x = i * (barWidth + barGap);
        const amount = Number(p.totalDeduction || 0);
        const h = maxDeduction > 0 ? (amount / maxDeduction) * height : 0;
        const y = height - h;
        const rate = p.pardonRatePercent;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth, 0.5)}
              height={amount > 0 ? Math.max(h, 1) : 0.5}
              rx="0.6"
              fill={amount === 0 ? "#e8edeb" : "#0f6e56"}
            >
              <title>
                {`${fmtDateShort(p.periodEnd)}: ${fmtMoney(amount)} deducted${
                  rate !== null && rate !== undefined
                    ? `, ${rate}% pardoned`
                    : ""
                }`}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

function SortIcon({ active, dir }) {
  if (!active)
    return (
      <i
        className="ti ti-selector"
        style={{ opacity: 0.35 }}
        aria-hidden="true"
      />
    );
  return (
    <i
      className={
        dir === "asc" ? "ti ti-sort-ascending" : "ti ti-sort-descending"
      }
      aria-hidden="true"
    />
  );
}

export default function PayrollReportView({ departments = [] }) {
  const navigate = useNavigate();

  const [periods, setPeriods] = useState(6);
  const [departmentId, setDepartmentId] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("deduction");
  const [sortDir, setSortDir] = useState("desc");

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getPayrollReport(
        departmentId || undefined,
        periods,
      );
      setReport(data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Couldn't load the payroll report.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [departmentId, periods]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const displayedEmployees = useMemo(() => {
    if (!report) return [];
    let list = report.employees;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          `${r.firstName} ${r.lastName || ""}`.toLowerCase().includes(q) ||
          (r.departmentName || "").toLowerCase().includes(q),
      );
    }
    if (sortKey) {
      const getter = SORT_FIELDS[sortKey];
      list = [...list].sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        if (typeof av === "string")
          return sortDir === "asc"
            ? av.localeCompare(bv)
            : bv.localeCompare(av);
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return list;
  }, [report, search, sortKey, sortDir]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportError("");
    try {
      await downloadPayrollCsv(departmentId || undefined, periods);
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
      await downloadPayrollPdf(departmentId || undefined, periods);
    } catch {
      setExportError("Couldn't generate the PDF export.");
    } finally {
      setExportingPdf(false);
    }
  };

  const deductionDelta = report
    ? fmtDelta(report.totalDeductionDelta, { invertColor: true, isMoney: true })
    : null;
  const pardonRateDelta = report
    ? fmtDelta(report.pardonRateDeltaPercent, { suffix: " pts", neutral: true })
    : null;

  const noPeriodsYet = report && report.periodsFound === 0;

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Payroll &amp; Penalty</h2>
          <p className={styles.subheading}>
            Deductions, pardons, and net pay across finalized pay periods.
          </p>
        </div>
        <div className={styles.exportBtns}>
          <button
            className={styles.exportBtn}
            onClick={handleExportCsv}
            disabled={exportingCsv || loading || noPeriodsYet}
          >
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            {exportingCsv ? "Preparing…" : "Export CSV"}
          </button>
          <button
            className={styles.exportBtnPrimary}
            onClick={handleExportPdf}
            disabled={exportingPdf || loading || noPeriodsYet}
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
        <ReportDropdown
          icon="ti-history"
          value={periods}
          onChange={(v) => setPeriods(Number(v))}
          options={PERIOD_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />

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
      ) : noPeriodsYet ? (
        <div className={styles.noPeriodsBanner}>
          <i
            className="ti ti-calendar-off"
            style={{ fontSize: 26 }}
            aria-hidden="true"
          />
          <p>
            No pay periods have been finalized yet
            {report.departmentName ? ` for ${report.departmentName}` : ""}. Run
            payroll from the Tools tab to see figures here.
          </p>
        </div>
      ) : report ? (
        <>
          <p className={styles.periodLine}>
            {report.periods.length > 0 && (
              <>
                {fmtDate(report.periods[0].periodStart)} –{" "}
                {fmtDate(report.periods[report.periods.length - 1].periodEnd)}
                {" · "}
              </>
            )}
            {report.periodsFound} of last {report.periodsRequested} periods
            {report.departmentName
              ? ` · ${report.departmentName}`
              : " · All departments"}
          </p>

          {/* ── Summary cards ── */}
          <div className={styles.cardsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total deductions</span>
              <span className={`${styles.statValue} ${styles.moneyText}`}>
                {fmtMoney(report.totalDeduction)}
              </span>
              {deductionDelta && (
                <span className={styles[`delta_${deductionDelta.cls}`]}>
                  {deductionDelta.text}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Pardon rate</span>
              <span className={styles.statValue}>
                {fmtRate(report.pardonRatePercent)}
              </span>
              {pardonRateDelta && (
                <span className={styles[`delta_${pardonRateDelta.cls}`]}>
                  {pardonRateDelta.text}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Net pay total</span>
              <span className={`${styles.statValue} ${styles.moneyText}`}>
                {fmtMoney(report.totalNetPay)}
              </span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardBad}`}>
              <span className={styles.statLabel}>Absences</span>
              <span className={styles.statValue}>{report.totalAbsent}</span>
            </div>
          </div>

          {/* ── Trend chart ── */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeadRow}>
              <h3 className={styles.sectionTitle}>
                Deduction trend by pay period
              </h3>
            </div>
            <DeductionTrendChart periods={report.periods} />
          </div>

          {/* ── Department breakdown ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>By department</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Employees</th>
                    <th>Late</th>
                    <th>Early leave</th>
                    <th>Absent</th>
                    <th>Total deduction</th>
                    <th>Pardon rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.departmentBreakdown.map((d) => (
                    <tr key={d.departmentName}>
                      <td className={styles.empName}>{d.departmentName}</td>
                      <td data-label="Employees">{d.employeeCount}</td>
                      <td data-label="Late">{d.lateCount}</td>
                      <td data-label="Early leave">{d.earlyLeaveCount}</td>
                      <td data-label="Absent">{d.absentCount}</td>
                      <td
                        data-label="Total deduction"
                        className={styles.moneyText}
                      >
                        {fmtMoney(d.totalDeduction)}
                      </td>
                      <td data-label="Pardon rate">
                        {fmtRate(d.pardonRatePercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Employee detail ── */}
          <div className={styles.sectionCard}>
            <div className={styles.employeeHeadRow}>
              <h3 className={styles.sectionTitle}>By employee</h3>
              <div className={styles.searchBox}>
                <i className="ti ti-search" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search employee or department…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.tableWrap}>
              {displayedEmployees.length === 0 ? (
                <div className={styles.empty}>
                  <i
                    className="ti ti-users"
                    style={{ fontSize: 26 }}
                    aria-hidden="true"
                  />
                  <p>No employees match your search.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("name")}
                      >
                        Employee{" "}
                        <SortIcon active={sortKey === "name"} dir={sortDir} />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("department")}
                      >
                        Department{" "}
                        <SortIcon
                          active={sortKey === "department"}
                          dir={sortDir}
                        />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("absent")}
                      >
                        Absent{" "}
                        <SortIcon active={sortKey === "absent"} dir={sortDir} />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("deduction")}
                      >
                        Total deduction{" "}
                        <SortIcon
                          active={sortKey === "deduction"}
                          dir={sortDir}
                        />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("netPay")}
                      >
                        Net pay{" "}
                        <SortIcon active={sortKey === "netPay"} dir={sortDir} />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("pardonRate")}
                      >
                        Pardon rate{" "}
                        <SortIcon
                          active={sortKey === "pardonRate"}
                          dir={sortDir}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEmployees.map((r) => (
                      <tr
                        key={r.employeeId}
                        className={styles.clickableRow}
                        onClick={() =>
                          navigate(`/employees/${r.employeeId}`, {
                            state: { from: "Reports" },
                          })
                        }
                      >
                        <td>
                          <div className={styles.empCell}>
                            <div className={styles.avatar}>
                              {initials(r.firstName, r.lastName)}
                            </div>
                            <span className={styles.empName}>
                              {r.firstName} {r.lastName}
                            </span>
                          </div>
                        </td>
                        <td data-label="Department">{r.departmentName}</td>
                        <td
                          data-label="Absent"
                          className={
                            r.absentCount > 0 ? styles.badText : undefined
                          }
                        >
                          {r.absentCount}
                        </td>
                        <td
                          data-label="Total deduction"
                          className={styles.moneyText}
                        >
                          {fmtMoney(r.totalDeduction)}
                        </td>
                        <td data-label="Net pay" className={styles.moneyText}>
                          {fmtMoney(r.totalNetPay)}
                        </td>
                        <td data-label="Pardon rate">
                          {fmtRate(r.pardonRatePercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
