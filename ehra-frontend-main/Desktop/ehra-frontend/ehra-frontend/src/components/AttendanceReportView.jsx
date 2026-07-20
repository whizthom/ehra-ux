import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAttendanceReport,
  downloadAttendanceCsv,
  downloadAttendancePdf,
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
    case "last7":
      return {
        from: iso(new Date(today.getTime() - 6 * 86400000)),
        to: iso(today),
      };
    default:
      return { from: iso(startOfMonth(today)), to: iso(today) };
  }
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateFull(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRate(v) {
  return v === null || v === undefined ? "—" : `${v}%`;
}

function fmtDelta(v, { invertColor = false, suffix = "" } = {}) {
  if (v === null || v === undefined) return null;
  if (v === 0) return { text: "No change vs last period", cls: "neutral" };
  const sign = v > 0 ? "+" : "";
  const isGood = invertColor ? v < 0 : v > 0;
  return {
    text: `${sign}${v}${suffix} vs last period`,
    cls: isGood ? "up" : "down",
  };
}

// Bucket the daily trend into at most ~20 points so the chart stays
// readable even over a long custom range, without losing the underlying
// day-level data (which is still what CSV/PDF export and the table use).
function bucketTrend(trend) {
  if (!trend || trend.length === 0) return [];
  if (trend.length <= 31) {
    return trend.map((t) => ({
      label: formatDate(t.date),
      rate: t.attendanceRatePercent,
    }));
  }
  const bucketSize = Math.ceil(trend.length / 20);
  const buckets = [];
  for (let i = 0; i < trend.length; i += bucketSize) {
    const slice = trend.slice(i, i + bucketSize);
    const withData = slice.filter((s) => s.attendanceRatePercent !== null);
    const avg = withData.length
      ? Math.round(
          (withData.reduce((a, b) => a + b.attendanceRatePercent, 0) /
            withData.length) *
            10,
        ) / 10
      : null;
    buckets.push({
      label: `${formatDate(slice[0].date)}`,
      rate: avg,
    });
  }
  return buckets;
}

function TrendChart({ trend }) {
  const points = bucketTrend(trend);
  if (points.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        No attendance data in this period yet.
      </div>
    );
  }

  const width = 100; // percentage-based viewBox, scales via CSS
  const height = 42;
  const barGap = 1;
  const barWidth = width / points.length - barGap;

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 10}`}
      className={styles.chartSvg}
      preserveAspectRatio="none"
    >
      {/* baseline */}
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke="#e8edeb"
        strokeWidth="0.3"
      />
      {points.map((p, i) => {
        const x = i * (barWidth + barGap);
        const h = p.rate === null ? 0 : (p.rate / 100) * height;
        const y = height - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth, 0.5)}
              height={h}
              rx="0.6"
              fill={
                p.rate === null
                  ? "#e8edeb"
                  : p.rate >= 80
                    ? "#0f6e56"
                    : p.rate >= 50
                      ? "#e5a339"
                      : "#c0392b"
              }
            >
              <title>{`${p.label}: ${p.rate === null ? "no data" : p.rate + "%"}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

const SORT_FIELDS = {
  name: (r) => `${r.firstName} ${r.lastName || ""}`.toLowerCase(),
  department: (r) => (r.departmentName || "").toLowerCase(),
  present: (r) => r.presentCount,
  late: (r) => r.lateCount,
  early: (r) => r.earlyLeaveCount,
  absent: (r) => r.absentCount,
  rate: (r) =>
    r.attendanceRatePercent === null ? -1 : r.attendanceRatePercent,
};

export default function AttendanceReportView({ departments = [] }) {
  const navigate = useNavigate();

  const [preset, setPreset] = useState("thisMonth");
  const initialRange = useMemo(() => presetRange("thisMonth"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [departmentId, setDepartmentId] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

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
      const { data } = await getAttendanceReport(
        from,
        to,
        departmentId || undefined,
      );
      setReport(data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Couldn't load the attendance report.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, departmentId]);

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
      await downloadAttendanceCsv(from, to, departmentId || undefined);
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
      await downloadAttendancePdf(from, to, departmentId || undefined);
    } catch {
      setExportError("Couldn't generate the PDF export.");
    } finally {
      setExportingPdf(false);
    }
  };

  const rateDelta = report
    ? fmtDelta(report.attendanceRateDeltaPercent, { suffix: " pts" })
    : null;
  const lateDelta = report
    ? fmtDelta(report.lateDelta, { invertColor: true })
    : null;
  const absentDelta = report
    ? fmtDelta(report.absentDelta, { invertColor: true })
    : null;

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Attendance &amp; Punctuality</h2>
          <p className={styles.subheading}>Trends, comparisons, and exports.</p>
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
            { key: "last7", label: "Last 7 days" },
            { key: "thisMonth", label: "This month" },
            { key: "lastMonth", label: "Last month" },
            { key: "thisQuarter", label: "This quarter" },
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
              : " · All departments"}
          </p>

          {/* ── Summary cards ── */}
          <div className={styles.cardsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Attendance rate</span>
              <span className={styles.statValue}>
                {fmtRate(report.attendanceRatePercent)}
              </span>
              {rateDelta && (
                <span className={styles[`delta_${rateDelta.cls}`]}>
                  {rateDelta.text}
                </span>
              )}
            </div>
            <div className={`${styles.statCard} ${styles.statCardWarn}`}>
              <span className={styles.statLabel}>Late arrivals</span>
              <span className={styles.statValue}>{report.totalLate}</span>
              {lateDelta && (
                <span className={styles[`delta_${lateDelta.cls}`]}>
                  {lateDelta.text}
                </span>
              )}
            </div>
            <div className={`${styles.statCard} ${styles.statCardWarn}`}>
              <span className={styles.statLabel}>Early leaves</span>
              <span className={styles.statValue}>{report.totalEarlyLeave}</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardBad}`}>
              <span className={styles.statLabel}>Absences</span>
              <span className={styles.statValue}>{report.totalAbsent}</span>
              {absentDelta && (
                <span className={styles[`delta_${absentDelta.cls}`]}>
                  {absentDelta.text}
                </span>
              )}
            </div>
          </div>

          {/* ── Trend chart ── */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeadRow}>
              <h3 className={styles.sectionTitle}>Attendance rate trend</h3>
              <div className={styles.legend}>
                <span>
                  <i className={styles.dotGood} /> 80%+
                </span>
                <span>
                  <i className={styles.dotMid} /> 50–79%
                </span>
                <span>
                  <i className={styles.dotBad} /> below 50%
                </span>
              </div>
            </div>
            <TrendChart trend={report.dailyTrend} />
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
                    <th>Attendance rate</th>
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
                      <td data-label="Attendance rate">
                        <div className={styles.rateBarWrap}>
                          <div className={styles.rateBarTrack}>
                            <div
                              className={styles.rateBarFill}
                              style={{
                                width: `${d.attendanceRatePercent ?? 0}%`,
                              }}
                            />
                          </div>
                          <span>{fmtRate(d.attendanceRatePercent)}</span>
                        </div>
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
                        onClick={() => handleSort("present")}
                      >
                        Present{" "}
                        <SortIcon
                          active={sortKey === "present"}
                          dir={sortDir}
                        />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("late")}
                      >
                        Late{" "}
                        <SortIcon active={sortKey === "late"} dir={sortDir} />
                      </th>
                      <th
                        className={styles.sortableTh}
                        onClick={() => handleSort("early")}
                      >
                        Early{" "}
                        <SortIcon active={sortKey === "early"} dir={sortDir} />
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
                        onClick={() => handleSort("rate")}
                      >
                        Rate{" "}
                        <SortIcon active={sortKey === "rate"} dir={sortDir} />
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
                        <td data-label="Present">{r.presentCount}</td>
                        <td
                          data-label="Late"
                          className={
                            r.lateCount > 0 ? styles.warnText : undefined
                          }
                        >
                          {r.lateCount}
                        </td>
                        <td data-label="Early">{r.earlyLeaveCount}</td>
                        <td
                          data-label="Absent"
                          className={
                            r.absentCount > 0 ? styles.badText : undefined
                          }
                        >
                          {r.absentCount}
                        </td>
                        <td data-label="Rate">
                          {fmtRate(r.attendanceRatePercent)}
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
