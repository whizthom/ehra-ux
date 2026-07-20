import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDepartmentHealthReport,
  downloadDepartmentHealthCsv,
  downloadDepartmentHealthPdf,
} from "../api/reportsApi";
import styles from "./ReportsTab.module.css";

function fmtRate(v) {
  return v === null || v === undefined ? "—" : `${v}%`;
}

function fmtMoney(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateFull(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AttentionBadge({ total }) {
  if (total >= 5) {
    return (
      <span className={`${styles.attentionBadge} ${styles.attentionHigh}`}>
        <i className="ti ti-flame" aria-hidden="true" /> Needs attention
      </span>
    );
  }
  if (total >= 1) {
    return (
      <span className={`${styles.attentionBadge} ${styles.attentionMed}`}>
        <i className="ti ti-clock" aria-hidden="true" /> {total} pending
      </span>
    );
  }
  return (
    <span className={`${styles.attentionBadge} ${styles.attentionLow}`}>
      <i className="ti ti-check" aria-hidden="true" /> All clear
    </span>
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

const SORT_FIELDS = {
  department: (r) => (r.departmentName || "").toLowerCase(),
  headcount: (r) => r.headcount,
  attendance: (r) =>
    r.attendanceRatePercent === null ? -1 : r.attendanceRatePercent,
  deduction: (r) => Number(r.deductionTotal || 0),
  pending: (r) => r.pendingApprovalsTotal,
};

export default function DepartmentHealthReportView() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sortKey, setSortKey] = useState("pending");
  const [sortDir, setSortDir] = useState("desc");

  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getDepartmentHealthReport();
      setReport(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't load the department health report.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "department" ? "asc" : "desc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!report) return [];
    const getter = SORT_FIELDS[sortKey];
    return [...report.rows].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (typeof av === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [report, sortKey, sortDir]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportError("");
    try {
      await downloadDepartmentHealthCsv();
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
      await downloadDepartmentHealthPdf();
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
          <h2 className={styles.heading}>Department Health</h2>
          <p className={styles.subheading}>
            One glanceable row per department — which team needs attention.
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
            As of {fmtDateFull(report.asOf)} · attendance is month-to-date (
            {fmtDateFull(report.attendanceFrom)} –{" "}
            {fmtDateFull(report.attendanceTo)}) · deductions from{" "}
            {report.payrollPeriodEnd
              ? `the period ending ${fmtDateFull(report.payrollPeriodEnd)}`
              : "no finalized pay period yet"}
          </p>

          {/* ── Summary cards ── */}
          <div className={styles.cardsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Departments</span>
              <span className={styles.statValue}>
                {report.totalDepartments}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total headcount</span>
              <span className={styles.statValue}>{report.totalHeadcount}</span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardWarn}`}>
              <span className={styles.statLabel}>Pending leave approvals</span>
              <span className={styles.statValue}>
                {report.totalPendingLeaveApprovals}
              </span>
            </div>
            <div className={`${styles.statCard} ${styles.statCardWarn}`}>
              <span className={styles.statLabel}>
                Pending profile-edit approvals
              </span>
              <span className={styles.statValue}>
                {report.totalPendingProfileEditApprovals}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total deductions</span>
              <span className={`${styles.statValue} ${styles.moneyText}`}>
                {fmtMoney(report.totalDeduction)}
              </span>
            </div>
          </div>

          {/* ── Department table ── */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>By department</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
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
                      onClick={() => handleSort("headcount")}
                    >
                      Headcount{" "}
                      <SortIcon
                        active={sortKey === "headcount"}
                        dir={sortDir}
                      />
                    </th>
                    <th
                      className={styles.sortableTh}
                      onClick={() => handleSort("attendance")}
                    >
                      Attendance rate{" "}
                      <SortIcon
                        active={sortKey === "attendance"}
                        dir={sortDir}
                      />
                    </th>
                    <th
                      className={styles.sortableTh}
                      onClick={() => handleSort("deduction")}
                    >
                      Deduction total{" "}
                      <SortIcon
                        active={sortKey === "deduction"}
                        dir={sortDir}
                      />
                    </th>
                    <th
                      className={styles.sortableTh}
                      onClick={() => handleSort("pending")}
                    >
                      Needs attention{" "}
                      <SortIcon active={sortKey === "pending"} dir={sortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((d) => (
                    <tr key={d.departmentName}>
                      <td className={styles.empName}>{d.departmentName}</td>
                      <td data-label="Headcount">{d.headcount}</td>
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
                      <td
                        data-label="Deduction total"
                        className={styles.moneyText}
                      >
                        {fmtMoney(d.deductionTotal)}
                      </td>
                      <td data-label="Needs attention">
                        <AttentionBadge total={d.pendingApprovalsTotal} />
                        {d.pendingApprovalsTotal > 0 && (
                          <div
                            className={styles.onLeaveMeta}
                            style={{ marginTop: 4 }}
                          >
                            {d.pendingLeaveApprovals} leave ·{" "}
                            {d.pendingProfileEditApprovals} profile edit
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
