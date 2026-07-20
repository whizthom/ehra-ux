import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getAttendanceReport,
  downloadAttendanceCsv,
  downloadAttendancePdf,
  getPayrollReport,
  downloadPayrollCsv,
  downloadPayrollPdf,
  getLeaveReport,
  downloadLeaveCsv,
  downloadLeavePdf,
  getDepartmentHealthReport,
  downloadDepartmentHealthCsv,
  downloadDepartmentHealthPdf,
  getWorkforceReport,
  downloadWorkforceCsv,
  downloadWorkforcePdf,
} from "../api/reportsApi";
import styles from "./BusinessReportModal.module.css";

/* ── date helpers ──────────────────────────────────────────────────────── */
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d) {
  // Monday-start week, matching how the rest of the app talks about "this week"
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  return monday;
}
function rangeFor(key) {
  const today = new Date();
  const to = iso(today);
  if (key === "day") return { from: to, to };
  if (key === "week") return { from: iso(startOfWeek(today)), to };
  return { from: iso(startOfMonth(today)), to }; // month
}

/* ── formatting helpers (same conventions as the existing report tabs) ── */
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
    year: "2-digit",
  });
}
function pct(v) {
  return v === null || v === undefined ? "—" : `${v}%`;
}
function num(v) {
  return v === null || v === undefined ? "0" : v;
}
function money(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
function initials(first, last) {
  return `${(first || "?")[0]}${(last || "")[0] || ""}`.toUpperCase();
}

/* Attendance-rate style thresholds used purely for the colored status dots
   on the department cards — not a fabricated metric, just a display
   convention over the real attendanceRatePercent value. */
function healthStatus(rate) {
  if (rate === null || rate === undefined) return "unknown";
  if (rate >= 85) return "good";
  if (rate >= 70) return "watch";
  return "attention";
}
const STATUS_LABEL = {
  good: "Healthy",
  watch: "Watch",
  attention: "Needs attention",
  unknown: "No data",
};

/* ── small reusable bits ─────────────────────────────────────────────── */
function TrendPill({ value, suffix = " pts", goodDirection = "up" }) {
  if (value === null || value === undefined) {
    return <span className={styles.trendPillFlat}>no prior data</span>;
  }
  if (value === 0) {
    return <span className={styles.trendPillFlat}>no change</span>;
  }
  const isUp = value > 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  return (
    <span
      className={`${styles.trendPill} ${isGood ? styles.trendGood : styles.trendBad}`}
    >
      <i className={`ti ${isUp ? "ti-trending-up" : "ti-trending-down"}`} />
      {isUp ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function StatTile({ value, label }) {
  return (
    <div className={styles.statTile}>
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLbl}>{label}</div>
    </div>
  );
}

function BarRow({ name, pctValue, valueLabel }) {
  return (
    <div className={styles.barRow}>
      <div className={styles.barName}>{name}</div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.max(0, Math.min(100, pctValue))}%` }}
        />
      </div>
      <div className={styles.barVal}>{valueLabel}</div>
    </div>
  );
}

function SectionHeader({ icon, title, note, exportButtons }) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadLeft}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        <span className={styles.sectionTitle}>{title}</span>
        {note && <span className={styles.sectionNote}>{note}</span>}
      </div>
      {exportButtons && <div className={styles.exportRow}>{exportButtons}</div>}
    </div>
  );
}

function ExportBtn({ icon, label, onClick, busy }) {
  return (
    <button
      type="button"
      className={styles.exportBtn}
      onClick={onClick}
      disabled={busy}
      title={label}
    >
      <i
        className={`ti ${busy ? "ti-loader-2" : icon} ${busy ? styles.spin : ""}`}
      />
      {label}
    </button>
  );
}

function ErrorBox({ message }) {
  return (
    <div className={styles.errorBox}>
      <i className="ti ti-alert-circle" /> {message}
    </div>
  );
}

function SectionSpinner() {
  return (
    <div className={styles.sectionLoading}>
      <div className={styles.spinner} />
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "payroll", label: "Payroll impact" },
  { id: "departments", label: "Departments" },
  { id: "workforce", label: "Workforce" },
];

export default function BusinessReportModal({ open, onClose }) {
  const [range, setRange] = useState("day");

  const [attendance, setAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState("");

  const [leave, setLeave] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveError, setLeaveError] = useState("");

  const [payroll, setPayroll] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(true);
  const [payrollError, setPayrollError] = useState("");

  const [deptHealth, setDeptHealth] = useState(null);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState("");

  const [workforce, setWorkforce] = useState(null);
  const [wfLoading, setWfLoading] = useState(true);
  const [wfError, setWfError] = useState("");

  const [busyExport, setBusyExport] = useState(""); // key of the button currently exporting
  const [activeSection, setActiveSection] = useState("overview");

  const scrollRef = useRef(null);
  const sectionRefs = useRef({});

  const { from, to } = useMemo(() => rangeFor(range), [range]);

  /* Attendance + Leave depend on the selected timeframe */
  const loadDateScoped = useCallback(async () => {
    setAttLoading(true);
    setAttError("");
    setLeaveLoading(true);
    setLeaveError("");
    try {
      const { data } = await getAttendanceReport(from, to, undefined);
      setAttendance(data);
    } catch (err) {
      setAttError(
        err?.response?.data?.message || "Couldn't load the attendance report.",
      );
    } finally {
      setAttLoading(false);
    }
    try {
      const { data } = await getLeaveReport(from, to, undefined);
      setLeave(data);
    } catch (err) {
      setLeaveError(
        err?.response?.data?.message || "Couldn't load the leave report.",
      );
    } finally {
      setLeaveLoading(false);
    }
  }, [from, to]);

  /* Payroll, department health, and workforce don't take a date range in
     the API today (payroll works in finalized pay periods, the other two
     are point-in-time snapshots), so these load once per time the modal
     opens rather than re-fetching on every timeframe click. */
  const loadSnapshot = useCallback(async () => {
    setPayrollLoading(true);
    setPayrollError("");
    setDeptLoading(true);
    setDeptError("");
    setWfLoading(true);
    setWfError("");

    try {
      const { data } = await getPayrollReport(undefined, undefined);
      setPayroll(data);
    } catch (err) {
      setPayrollError(
        err?.response?.data?.message || "Couldn't load the payroll report.",
      );
    } finally {
      setPayrollLoading(false);
    }
    try {
      const { data } = await getDepartmentHealthReport();
      setDeptHealth(data);
    } catch (err) {
      setDeptError(
        err?.response?.data?.message ||
          "Couldn't load the department health report.",
      );
    } finally {
      setDeptLoading(false);
    }
    try {
      const { data } = await getWorkforceReport();
      setWorkforce(data);
    } catch (err) {
      setWfError(
        err?.response?.data?.message || "Couldn't load the workforce report.",
      );
    } finally {
      setWfLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadDateScoped();
  }, [open, loadDateScoped]);

  useEffect(() => {
    if (!open) return;
    loadSnapshot();
    setActiveSection("overview");
  }, [open, loadSnapshot]);

  /* Scrollspy: highlight the pill for whichever section is in view */
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [open, attendance, leave, payroll, deptHealth, workforce]);

  if (!open) return null;

  const jumpTo = (id) => {
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const runExport = async (key, fn) => {
    setBusyExport(key);
    try {
      await fn();
    } catch {
      // export failures are non-fatal to the report view; the button
      // simply stops spinning and the person can retry.
    } finally {
      setBusyExport("");
    }
  };

  const rangeLabel =
    range === "day" ? fmtDate(to) : `${fmtDate(from)} – ${fmtDate(to)}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <i className="ti ti-report-analytics" />
            </div>
            <div>
              <h3 className={styles.headerTitle}>Business report</h3>
              <p className={styles.headerSub}>{rangeLabel}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <i className="ti ti-x" />
          </button>
        </div>

        {/* timeframe */}
        <div className={styles.segmented}>
          {[
            { key: "day", label: "Today" },
            { key: "week", label: "This week" },
            { key: "month", label: "This month" },
          ].map((r) => (
            <button
              key={r.key}
              type="button"
              className={`${styles.segBtn} ${range === r.key ? styles.segBtnActive : ""}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* section pill nav */}
        <div className={styles.pillNav}>
          {NAV_ITEMS.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`${styles.pill} ${activeSection === n.id ? styles.pillActive : ""}`}
              onClick={() => jumpTo(n.id)}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className={styles.body} ref={scrollRef}>
          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          <section
            id="overview"
            ref={(el) => (sectionRefs.current.overview = el)}
            className={styles.section}
          >
            {attLoading || leaveLoading || payrollLoading || wfLoading ? (
              <SectionSpinner />
            ) : attError ? (
              <ErrorBox message={attError} />
            ) : (
              <>
                <div className={styles.heroCard}>
                  <div className={styles.gaugeWrap}>
                    <GaugeSvg
                      percent={attendance?.attendanceRatePercent ?? 0}
                    />
                    <div className={styles.gaugeCenter}>
                      <div className={styles.gaugeNum}>
                        {attendance?.attendanceRatePercent ?? "—"}%
                      </div>
                      <div className={styles.gaugeSub}>attendance rate</div>
                    </div>
                  </div>
                  <p className={styles.heroCaption}>
                    {buildNarrative({ attendance, leave, payroll, workforce })}
                  </p>
                </div>

                <div className={styles.quickGrid}>
                  <StatTile
                    value={`${attendance?.attendanceRatePercent ?? "—"}%`}
                    label="Attendance rate"
                  />
                  <StatTile
                    value={
                      payrollError ? "—" : `${money(payroll?.totalDeduction)}`
                    }
                    label="Payroll deduction (recent periods)"
                  />
                  <StatTile
                    value={leaveError ? "—" : num(leave?.totalPending)}
                    label="Open leave requests"
                  />
                  <StatTile
                    value={wfError ? "—" : num(workforce?.totalHeadcount)}
                    label="Active headcount"
                  />
                </div>
              </>
            )}
          </section>

          {/* ── ATTENDANCE ───────────────────────────────────────────── */}
          <section
            id="attendance"
            ref={(el) => (sectionRefs.current.attendance = el)}
            className={styles.section}
          >
            <SectionHeader
              icon="ti-calendar-stats"
              title="Attendance"
              exportButtons={
                <>
                  <ExportBtn
                    icon="ti-file-type-csv"
                    label="CSV"
                    busy={busyExport === "att-csv"}
                    onClick={() =>
                      runExport("att-csv", () =>
                        downloadAttendanceCsv(from, to, undefined),
                      )
                    }
                  />
                  <ExportBtn
                    icon="ti-file-type-pdf"
                    label="PDF"
                    busy={busyExport === "att-pdf"}
                    onClick={() =>
                      runExport("att-pdf", () =>
                        downloadAttendancePdf(from, to, undefined),
                      )
                    }
                  />
                </>
              }
            />
            {attLoading ? (
              <SectionSpinner />
            ) : attError ? (
              <ErrorBox message={attError} />
            ) : (
              <>
                <div className={styles.heroMetric}>
                  <div>
                    <div className={styles.heroLabel}>Attendance rate</div>
                    <div className={styles.heroRow}>
                      <div className={styles.heroNum}>
                        {attendance.attendanceRatePercent}%
                      </div>
                      <TrendPill
                        value={attendance.attendanceRateDeltaPercent}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.statGrid}>
                  <StatTile
                    value={num(attendance.totalPresent)}
                    label="Present"
                  />
                  <StatTile value={num(attendance.totalLate)} label="Late" />
                  <StatTile
                    value={num(attendance.totalEarlyLeave)}
                    label="Early leave"
                  />
                  <StatTile
                    value={num(attendance.totalAbsent)}
                    label="Absent"
                  />
                </div>

                <div className={styles.subLabel}>By department</div>
                {!attendance.departmentBreakdown?.length ? (
                  <div className={styles.emptyNote}>
                    No departments in range.
                  </div>
                ) : (
                  attendance.departmentBreakdown.map((d) => (
                    <BarRow
                      key={d.departmentName}
                      name={d.departmentName}
                      pctValue={d.attendanceRatePercent ?? 0}
                      valueLabel={pct(d.attendanceRatePercent)}
                    />
                  ))
                )}

                {attendance.employees?.length > 0 && (
                  <>
                    <div className={styles.subLabel}>Needs attention</div>
                    <div className={styles.listCard}>
                      {[...attendance.employees]
                        .sort(
                          (a, b) =>
                            (a.attendanceRatePercent ?? 100) -
                            (b.attendanceRatePercent ?? 100),
                        )
                        .slice(0, 3)
                        .map((e, i) => (
                          <div
                            key={`${e.firstName}-${e.lastName}-${i}`}
                            className={styles.listRow}
                          >
                            <div className={styles.avatar}>
                              {initials(e.firstName, e.lastName)}
                            </div>
                            <div className={styles.listText}>
                              <div className={styles.listTitle}>
                                {fullName(e.firstName, e.lastName)}
                              </div>
                              <div className={styles.listMeta}>
                                {e.departmentName} · late {e.lateCount}, early{" "}
                                {e.earlyLeaveCount}, absent {e.absentCount}
                              </div>
                            </div>
                            <div className={styles.listVal}>
                              {pct(e.attendanceRatePercent)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          {/* ── LEAVE ────────────────────────────────────────────────── */}
          <section
            id="leave"
            ref={(el) => (sectionRefs.current.leave = el)}
            className={styles.section}
          >
            <SectionHeader
              icon="ti-calendar-heart"
              title="Leave"
              exportButtons={
                <>
                  <ExportBtn
                    icon="ti-file-type-csv"
                    label="CSV"
                    busy={busyExport === "leave-csv"}
                    onClick={() =>
                      runExport("leave-csv", () =>
                        downloadLeaveCsv(from, to, undefined),
                      )
                    }
                  />
                  <ExportBtn
                    icon="ti-file-type-pdf"
                    label="PDF"
                    busy={busyExport === "leave-pdf"}
                    onClick={() =>
                      runExport("leave-pdf", () =>
                        downloadLeavePdf(from, to, undefined),
                      )
                    }
                  />
                </>
              }
            />
            {leaveLoading ? (
              <SectionSpinner />
            ) : leaveError ? (
              <ErrorBox message={leaveError} />
            ) : (
              <>
                <div className={styles.statGrid}>
                  <StatTile value={num(leave.totalRequests)} label="Requests" />
                  <StatTile value={num(leave.totalApproved)} label="Approved" />
                  <StatTile value={num(leave.totalPending)} label="Pending" />
                  <StatTile value={num(leave.totalRejected)} label="Rejected" />
                </div>

                <div className={styles.subLabel}>By leave type</div>
                {!leave.typeStatusBreakdown?.length ? (
                  <div className={styles.emptyNote}>No requests in range.</div>
                ) : (
                  (() => {
                    const max = Math.max(
                      1,
                      ...leave.typeStatusBreakdown.map((t) => t.totalCount),
                    );
                    return leave.typeStatusBreakdown.map((t) => (
                      <BarRow
                        key={t.leaveType}
                        name={titleCase(t.leaveType)}
                        pctValue={(t.totalCount / max) * 100}
                        valueLabel={t.totalCount}
                      />
                    ));
                  })()
                )}

                <div className={styles.subLabel}>
                  Currently on leave ({leave.currentlyOnLeave?.length || 0})
                </div>
                {!leave.currentlyOnLeave?.length ? (
                  <div className={styles.emptyNote}>
                    Nobody is on approved leave today.
                  </div>
                ) : (
                  <div className={styles.listCard}>
                    {leave.currentlyOnLeave.map((r, i) => (
                      <div key={i} className={styles.listRow}>
                        <div className={styles.avatar}>
                          {initials(r.firstName, r.lastName)}
                        </div>
                        <div className={styles.listText}>
                          <div className={styles.listTitle}>
                            {fullName(r.firstName, r.lastName)}
                          </div>
                          <div className={styles.listMeta}>
                            {titleCase(r.leaveType)} · {fmtDate(r.startDate)} –{" "}
                            {fmtDate(r.endDate)}
                            {r.coverPersonFirstName
                              ? ` · covered by ${fullName(r.coverPersonFirstName, r.coverPersonLastName)}`
                              : ""}
                          </div>
                        </div>
                        <div className={styles.listVal}>
                          {r.daysRemaining}d left
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── PAYROLL IMPACT ───────────────────────────────────────── */}
          <section
            id="payroll"
            ref={(el) => (sectionRefs.current.payroll = el)}
            className={styles.section}
          >
            <SectionHeader
              icon="ti-cash"
              title="Payroll impact"
              note={
                payroll
                  ? `last ${payroll.periodsFound} of ${payroll.periodsRequested} periods`
                  : null
              }
              exportButtons={
                <>
                  <ExportBtn
                    icon="ti-file-type-csv"
                    label="CSV"
                    busy={busyExport === "pay-csv"}
                    onClick={() =>
                      runExport("pay-csv", () =>
                        downloadPayrollCsv(undefined, undefined),
                      )
                    }
                  />
                  <ExportBtn
                    icon="ti-file-type-pdf"
                    label="PDF"
                    busy={busyExport === "pay-pdf"}
                    onClick={() =>
                      runExport("pay-pdf", () =>
                        downloadPayrollPdf(undefined, undefined),
                      )
                    }
                  />
                </>
              }
            />
            {payrollLoading ? (
              <SectionSpinner />
            ) : payrollError ? (
              <ErrorBox message={payrollError} />
            ) : payroll.periodsFound === 0 ? (
              <div className={styles.emptyNote}>
                No finalized pay periods yet.
              </div>
            ) : (
              <>
                <div className={styles.payrollHero}>
                  <div className={styles.heroLabel}>
                    Recovered via deductions
                  </div>
                  <div className={styles.payrollAmt}>
                    {money(payroll.totalDeduction)}
                  </div>
                  <TrendPill
                    value={payroll.totalDeductionDelta}
                    suffix=""
                    goodDirection="down"
                  />
                </div>

                <div className={styles.statGrid}>
                  <StatTile value={num(payroll.totalLate)} label="Late" />
                  <StatTile
                    value={num(payroll.totalEarlyLeave)}
                    label="Early leave"
                  />
                  <StatTile value={num(payroll.totalAbsent)} label="Absent" />
                  <StatTile
                    value={pct(payroll.pardonRatePercent)}
                    label="Pardon rate"
                  />
                </div>

                <div className={styles.subLabel}>Deduction by department</div>
                {!payroll.departmentBreakdown?.length ? (
                  <div className={styles.emptyNote}>
                    No departments in range.
                  </div>
                ) : (
                  (() => {
                    const max = Math.max(
                      1,
                      ...payroll.departmentBreakdown.map((d) =>
                        Number(d.totalDeduction || 0),
                      ),
                    );
                    return payroll.departmentBreakdown.map((d) => (
                      <BarRow
                        key={d.departmentName}
                        name={d.departmentName}
                        pctValue={(Number(d.totalDeduction || 0) / max) * 100}
                        valueLabel={money(d.totalDeduction)}
                      />
                    ));
                  })()
                )}

                <div className={styles.subLabel}>By pay period</div>
                <div className={styles.listCard}>
                  {payroll.periods.map((p, i) => (
                    <div key={i} className={styles.listRow}>
                      <div className={styles.listText}>
                        <div className={styles.listTitle}>
                          Period ending {fmtDate(p.periodEnd)}
                        </div>
                        <div className={styles.listMeta}>
                          late {p.lateCount}, early {p.earlyLeaveCount}, absent{" "}
                          {p.absentCount}, pardoned {p.pardonedCount}
                        </div>
                      </div>
                      <div className={styles.listVal}>
                        {money(p.totalDeduction)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ── DEPARTMENTS ──────────────────────────────────────────── */}
          <section
            id="departments"
            ref={(el) => (sectionRefs.current.departments = el)}
            className={styles.section}
          >
            <SectionHeader
              icon="ti-building-community"
              title="Department health"
              note={deptHealth ? `as of ${fmtDate(deptHealth.asOf)}` : null}
              exportButtons={
                <>
                  <ExportBtn
                    icon="ti-file-type-csv"
                    label="CSV"
                    busy={busyExport === "dept-csv"}
                    onClick={() =>
                      runExport("dept-csv", downloadDepartmentHealthCsv)
                    }
                  />
                  <ExportBtn
                    icon="ti-file-type-pdf"
                    label="PDF"
                    busy={busyExport === "dept-pdf"}
                    onClick={() =>
                      runExport("dept-pdf", downloadDepartmentHealthPdf)
                    }
                  />
                </>
              }
            />
            {deptLoading ? (
              <SectionSpinner />
            ) : deptError ? (
              <ErrorBox message={deptError} />
            ) : !deptHealth.rows?.length ? (
              <div className={styles.emptyNote}>No departments yet.</div>
            ) : (
              deptHealth.rows.map((d) => {
                const status = healthStatus(d.attendanceRatePercent);
                return (
                  <div key={d.departmentName} className={styles.deptCard}>
                    <div className={styles.deptCardHead}>
                      <div className={styles.deptCardTitle}>
                        <span
                          className={`${styles.statusDot} ${styles["dot" + status[0].toUpperCase() + status.slice(1)]}`}
                        />
                        {d.departmentName}
                      </div>
                      <span
                        className={`${styles.statusBadge} ${styles["badge" + status[0].toUpperCase() + status.slice(1)]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div className={styles.deptCardMetrics}>
                      <span>
                        Headcount <b>{d.headcount}</b>
                      </span>
                      <span>
                        Attendance <b>{pct(d.attendanceRatePercent)}</b>
                      </span>
                      <span>
                        Deduction <b>{money(d.deductionTotal)}</b>
                      </span>
                      <span>
                        Pending{" "}
                        <b>
                          {num(d.pendingLeaveApprovals) +
                            num(d.pendingProfileEditApprovals)}
                        </b>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* ── WORKFORCE ────────────────────────────────────────────── */}
          <section
            id="workforce"
            ref={(el) => (sectionRefs.current.workforce = el)}
            className={styles.section}
          >
            <SectionHeader
              icon="ti-users-group"
              title="Workforce overview"
              note={workforce ? `as of ${fmtDate(workforce.asOf)}` : null}
              exportButtons={
                <>
                  <ExportBtn
                    icon="ti-file-type-csv"
                    label="CSV"
                    busy={busyExport === "wf-csv"}
                    onClick={() => runExport("wf-csv", downloadWorkforceCsv)}
                  />
                  <ExportBtn
                    icon="ti-file-type-pdf"
                    label="PDF"
                    busy={busyExport === "wf-pdf"}
                    onClick={() => runExport("wf-pdf", downloadWorkforcePdf)}
                  />
                </>
              }
            />
            {wfLoading ? (
              <SectionSpinner />
            ) : wfError ? (
              <ErrorBox message={wfError} />
            ) : (
              <>
                <div className={styles.wfHeroRow}>
                  <div className={styles.wfHeroNum}>
                    {workforce.totalHeadcount}
                  </div>
                  <div className={styles.wfHeroLbl}>
                    total employees across {workforce.totalDepartments}{" "}
                    department{workforce.totalDepartments === 1 ? "" : "s"}
                  </div>
                </div>

                <div className={styles.statGrid}>
                  <StatTile
                    value={num(workforce.totalHiresInTrend)}
                    label={`Hires (${workforce.trendMonths}mo)`}
                  />
                  <StatTile
                    value={num(workforce.totalDeparturesInTrend)}
                    label={`Departures (${workforce.trendMonths}mo)`}
                  />
                  <StatTile
                    value={num(workforce.departmentsWithoutHodCount)}
                    label="Depts without HOD"
                  />
                  <StatTile
                    value={num(workforce.totalDepartments)}
                    label="Departments"
                  />
                </div>

                <div className={styles.subLabel}>Employment type</div>
                {(() => {
                  const rows = workforce.employmentTypeBreakdown || [];
                  const max = Math.max(1, ...rows.map((t) => t.count));
                  return rows.map((t) => (
                    <BarRow
                      key={t.employmentType}
                      name={titleCase(t.employmentType)}
                      pctValue={(t.count / max) * 100}
                      valueLabel={t.count}
                    />
                  ));
                })()}

                <div className={styles.subLabel}>Monthly trend</div>
                <div className={styles.trendChart}>
                  {(workforce.trend || []).map((t, i) => {
                    const maxHc = Math.max(
                      1,
                      ...(workforce.trend || []).map(
                        (x) => x.headcountAtMonthEnd,
                      ),
                    );
                    const h = (t.headcountAtMonthEnd / maxHc) * 100;
                    return (
                      <div key={i} className={styles.trendCol}>
                        <div
                          className={styles.trendBar}
                          style={{ height: `${h}%` }}
                          title={`${t.headcountAtMonthEnd} employees`}
                        />
                        <div className={styles.trendLbl}>
                          {fmtMonth(t.periodStart)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {workforce.departmentsWithoutHod?.length > 0 && (
                  <>
                    <div className={styles.subLabel}>
                      Departments without a HOD
                    </div>
                    <div className={styles.emptyNote}>
                      {workforce.departmentsWithoutHod.join(", ")}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {/* footer */}
        <div className={styles.footer}>
          <button
            className={styles.closeFooterBtn}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── gauge SVG (matches TodaysPulse's ring styling/tokens) ────────────── */
function GaugeSvg({ percent }) {
  const R = 64;
  const STROKE = 12;
  const circumference = 2 * Math.PI * R;
  const clamped = Math.min(Math.max(percent || 0, 0), 100);
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg viewBox="0 0 160 160" className={styles.gaugeSvg}>
      <circle
        cx="80"
        cy="80"
        r={R}
        className={styles.gaugeTrack}
        strokeWidth={STROKE}
      />
      <circle
        cx="80"
        cy="80"
        r={R}
        className={styles.gaugeProgress}
        strokeWidth={STROKE}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/* ── narrative sentence built entirely from real, already-fetched fields ── */
function buildNarrative({ attendance, leave, payroll, workforce }) {
  const bits = [];
  if (attendance?.attendanceRateDeltaPercent != null) {
    const d = attendance.attendanceRateDeltaPercent;
    if (d === 0) bits.push("Attendance is flat vs the prior period");
    else
      bits.push(
        `Attendance is ${d > 0 ? "up" : "down"} ${Math.abs(d)} pts vs the prior period`,
      );
  }
  if (
    payroll?.totalDeductionDelta != null &&
    payroll.totalDeductionDelta !== 0
  ) {
    const d = payroll.totalDeductionDelta;
    bits.push(
      `payroll deductions are ${d > 0 ? "up" : "down"} ${money(Math.abs(d))}`,
    );
  }
  if (leave?.totalPending) {
    bits.push(
      `${leave.totalPending} leave request${leave.totalPending === 1 ? "" : "s"} awaiting your decision`,
    );
  }
  if (workforce?.departmentsWithoutHodCount) {
    bits.push(
      `${workforce.departmentsWithoutHodCount} department${workforce.departmentsWithoutHodCount === 1 ? "" : "s"} without a HOD`,
    );
  }
  if (!bits.length) return "Everything looks steady for this period.";
  return bits.join(", ") + ".";
}
