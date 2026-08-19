import { useState, useEffect, useCallback } from "react";
import API from "../api/authApi";
import {
  getBranchDashboard,
  getBranchEmployees,
  getEmployeeBranchHistory,
  getBranchLeave,
  getBranchPayroll,
  getBranchAttendance,
  assignEmployeeBranch,
} from "../api/branchApi";
import CustomSelect from "./CustomSelect";
import BranchQrPanel from "./BranchQrPanel";
import BranchQrDisplayLinkPanel from "./BranchQrDisplayLinkPanel";
import BranchAttendanceSettingsPanel from "./BranchAttendanceSettingsPanel";
import styles from "./BranchDetail.module.css";

function nameInitials(name) {
  return (
    (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const TABS = [
  { key: "overview", label: "Overview", icon: "ti-layout-dashboard" },
  { key: "employees", label: "Employees", icon: "ti-users" },
  { key: "attendance", label: "Attendance", icon: "ti-calendar-check" },
  { key: "leave", label: "Leave", icon: "ti-beach" },
  { key: "payroll", label: "Payroll", icon: "ti-cash" },
  { key: "qr", label: "Attendance QR", icon: "ti-qrcode" },
];

function StatBlock({ icon, colorClass, value, label }) {
  return (
    <div className={styles.statBlock}>
      <span className={`${styles.statBlockIcon} ${colorClass}`}>
        <i className={`ti ${icon}`} aria-hidden="true" />
      </span>
      <div>
        <div className={styles.statBlockValue}>{value}</div>
        <div className={styles.statBlockLabel}>{label}</div>
      </div>
    </div>
  );
}

function OverviewTab({ branchId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranchDashboard(branchId)
      .then(({ data }) => !cancelled && setSummary(data))
      .catch(
        () => !cancelled && setError("Couldn't load this branch's overview."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  if (loading) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={styles.tabError}>{error || "No data available."}</div>
    );
  }

  return (
    <div className={styles.overviewGrid}>
      <section className={styles.overviewSection}>
        <h4 className={styles.sectionTitle}>Employees</h4>
        <div className={styles.statBlockRow}>
          <StatBlock
            icon="ti-users"
            colorClass={styles.colorIndigo}
            value={summary.totalEmployees}
            label="Total employees"
          />
        </div>
      </section>

      <section className={styles.overviewSection}>
        <h4 className={styles.sectionTitle}>Today's attendance</h4>
        <div className={styles.statBlockRow}>
          <StatBlock
            icon="ti-circle-check"
            colorClass={styles.colorGreen}
            value={summary.presentToday}
            label="Present"
          />
          <StatBlock
            icon="ti-clock-exclamation"
            colorClass={styles.colorAmber}
            value={summary.lateToday}
            label="Late"
          />
          <StatBlock
            icon="ti-circle-x"
            colorClass={styles.colorRed}
            value={summary.absentToday}
            label="Absent"
          />
          <StatBlock
            icon="ti-door-exit"
            colorClass={styles.colorAmber}
            value={summary.earlyLeaveToday}
            label="Early leave"
          />
          <StatBlock
            icon="ti-user-question"
            colorClass={styles.colorGray}
            value={summary.notYetClockedInToday}
            label="Not clocked in yet"
          />
        </div>
      </section>

      <section className={styles.overviewSection}>
        <h4 className={styles.sectionTitle}>Leave</h4>
        <div className={styles.statBlockRow}>
          <StatBlock
            icon="ti-beach"
            colorClass={styles.colorIndigo}
            value={summary.onLeaveToday}
            label="On leave today"
          />
          <StatBlock
            icon="ti-hourglass"
            colorClass={styles.colorAmber}
            value={summary.pendingLeaveRequests}
            label="Pending requests"
          />
        </div>
      </section>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

// Expandable row — clicking an employee reveals their branch-transfer
// timeline inline (a custom accordion, not a native popup/dialog), fetched
// lazily so opening the Employees tab doesn't pay for every employee's
// history up front.
function EmployeeHistoryRow({ emp }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && history === null && !loading) {
      setLoading(true);
      getEmployeeBranchHistory(emp.id)
        .then(({ data }) => setHistory(data))
        .catch((err) => {
          if (err?.response?.status === 403) {
            setError("Only business admins can view transfer history.");
          } else {
            setError("Couldn't load transfer history.");
          }
        })
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className={styles.employeeRowWrap}>
      <button
        type="button"
        className={styles.employeeRow}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={styles.employeeAvatar}>
          {nameInitials(`${emp.firstName || ""} ${emp.lastName || ""}`)}
        </span>
        <div className={styles.employeeInfo}>
          <span className={styles.employeeName}>
            {emp.firstName} {emp.lastName}
          </span>
          <span className={styles.employeeMeta}>{emp.email}</span>
        </div>
        <span className={styles.employeePosition}>{emp.position || "—"}</span>
        <i
          className={`ti ti-chevron-down ${styles.employeeChevron} ${open ? styles.employeeChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.historyPanel}>
          {loading && (
            <div className={styles.historyLoading}>
              Loading transfer history…
            </div>
          )}
          {error && <div className={styles.historyError}>{error}</div>}
          {!loading && !error && history && history.length === 0 && (
            <div className={styles.historyEmpty}>
              No branch transfers recorded for this employee yet.
            </div>
          )}
          {!loading && !error && history && history.length > 0 && (
            <ul className={styles.historyList}>
              {history.map((h) => (
                <li key={h.id} className={styles.historyItem}>
                  <span className={styles.historyIcon}>
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </span>
                  <div className={styles.historyText}>
                    <div className={styles.historyLine}>
                      <span
                        className={
                          h.previousBranchName ? "" : styles.historyMuted
                        }
                      >
                        {h.previousBranchName || "Unassigned"}
                      </span>
                      <i
                        className="ti ti-arrow-narrow-right"
                        aria-hidden="true"
                      />
                      <span
                        className={h.newBranchName ? "" : styles.historyMuted}
                      >
                        {h.newBranchName || "Unassigned"}
                      </span>
                    </div>
                    <div className={styles.historyMeta}>
                      {formatDate(h.effectiveAt)}
                      {h.changedByLabel && <> · by {h.changedByLabel}</>}
                      {h.reason && <> · {h.reason}</>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AddEmployeeToBranchWidget({ branchId, branchName, onAdded, toast }) {
  const [open, setOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);
  const [pickedId, setPickedId] = useState("");

  const openPicker = () => {
    setOpen(true);
    if (allEmployees === null) {
      setLoading(true);
      API.get("/employees/directory")
        .then(({ data }) => setAllEmployees(data.filter((e) => !e.deletedAt)))
        .catch(() => setError("Couldn't load your employee directory."))
        .finally(() => setLoading(false));
    }
  };

  const handleAssign = async () => {
    if (!pickedId) return;
    setAssigning(true);
    setError(null);
    try {
      const { data } = await assignEmployeeBranch(Number(pickedId), branchId);
      onAdded(data);
      toast?.(
        `${data.firstName} ${data.lastName} added to ${branchName}.`,
        "success",
      );
      setOpen(false);
      setPickedId("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Couldn't add this employee to the branch.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.addEmployeeBtn}
        onClick={openPicker}
      >
        <i className="ti ti-user-plus" aria-hidden="true" />
        Add employee
      </button>
    );
  }

  const options = (allEmployees || [])
    // Employees already at this branch don't need to show up as pickable —
    // they're already visible in the list below.
    .filter((e) => e.branchId !== branchId)
    .map((e) => ({
      value: String(e.id),
      label: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.email,
      emp: e,
    }));

  return (
    <div className={styles.addEmployeeWidget}>
      {loading ? (
        <span className={styles.addEmployeeLoading}>Loading employees…</span>
      ) : (
        <>
          <div className={styles.addEmployeeSelectWrap}>
            <CustomSelect
              value={pickedId}
              onChange={(v) => setPickedId(v || "")}
              options={options}
              placeholder="Search employees…"
              searchable
              searchPlaceholder="Search by name…"
              emptyLabel="No other employees to add"
              renderOption={(opt, isSelected) => (
                <>
                  <span className={styles.optionAvatar}>
                    {nameInitials(opt.label)}
                  </span>
                  <span>{opt.label}</span>
                  {opt.emp.branch && opt.emp.branch !== "Unassigned" && (
                    <span className={styles.addEmployeeCurrentBranch}>
                      from {opt.emp.branch}
                    </span>
                  )}
                  {isSelected && (
                    <i className="ti ti-check" aria-hidden="true" />
                  )}
                </>
              )}
            />
          </div>
          <button
            type="button"
            className={styles.primaryMiniBtn}
            onClick={handleAssign}
            disabled={!pickedId || assigning}
          >
            {assigning ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            className={styles.cancelMiniBtn}
            onClick={() => {
              setOpen(false);
              setPickedId("");
              setError(null);
            }}
            disabled={assigning}
          >
            Cancel
          </button>
        </>
      )}
      {error && <div className={styles.addEmployeeError}>{error}</div>}
    </div>
  );
}

function EmployeesTab({ branchId, branchName, toast }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranchEmployees(branchId, page, 10)
      .then(({ data }) => !cancelled && setData(data))
      .catch(
        () =>
          !cancelled && setError("Couldn't load employees for this branch."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, page, refreshTick]);

  if (loading && !data) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) return <div className={styles.tabError}>{error}</div>;

  const employees = data?.content || [];

  return (
    <div className={styles.employeesWrap}>
      <div className={styles.tabToolbar}>
        <AddEmployeeToBranchWidget
          branchId={branchId}
          branchName={branchName}
          toast={toast}
          onAdded={() => {
            setPage(0);
            setRefreshTick((t) => t + 1);
          }}
        />
      </div>

      {employees.length === 0 ? (
        <div className={styles.emptyMini}>
          <i className="ti ti-user-off" aria-hidden="true" />
          <p>No employees assigned to this branch yet.</p>
        </div>
      ) : (
        <>
          <div className={styles.employeeTable}>
            {employees.map((emp) => (
              <EmployeeHistoryRow key={emp.id} emp={emp} />
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <span className={styles.pageInfo}>
                Page {page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ATTENDANCE_STATUS_LABELS = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early leave",
  ABSENT: "Absent",
};

function attendanceStatusClass(status) {
  if (status === "PRESENT") return styles.leaveStatusApproved;
  if (status === "ABSENT") return styles.leaveStatusRejected;
  return styles.leaveStatusPending; // LATE, EARLY_LEAVE
}

function formatClock(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AttendanceTab({ branchId }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranchAttendance(branchId, page, 15)
      .then(({ data }) => !cancelled && setData(data))
      .catch(
        () =>
          !cancelled && setError("Couldn't load attendance for this branch."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, page]);

  if (loading && !data) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) return <div className={styles.tabError}>{error}</div>;

  const rows = data?.content || [];

  if (rows.length === 0) {
    return (
      <div className={styles.emptyMini}>
        <i className="ti ti-calendar-off" aria-hidden="true" />
        <p>No attendance recorded for this branch yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.employeesWrap}>
      <div className={styles.employeeTable}>
        {rows.map((a) => (
          <div key={a.id} className={styles.leaveRow}>
            <span className={styles.employeeAvatar}>
              {nameInitials(
                `${a.employeeFirstName || ""} ${a.employeeLastName || ""}`,
              )}
            </span>
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>
                {a.employeeFirstName} {a.employeeLastName}
              </span>
              <span className={styles.employeeMeta}>
                {a.date} · in {formatClock(a.clockIn)} · out{" "}
                {formatClock(a.clockOut)}
              </span>
            </div>
            <span
              className={`${styles.leaveStatusBadge} ${attendanceStatusClass(a.status)}`}
            >
              {ATTENDANCE_STATUS_LABELS[a.status] || a.status}
            </span>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

const LEAVE_STATUS_LABELS = {
  PENDING_COVER: "Pending cover",
  COVER_DECLINED: "Cover declined",
  PENDING_HOD: "Pending HOD",
  PENDING_EMPLOYER: "Pending employer",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function leaveStatusClass(status) {
  if (status === "APPROVED") return styles.leaveStatusApproved;
  if (status === "REJECTED" || status === "CANCELLED")
    return styles.leaveStatusRejected;
  return styles.leaveStatusPending;
}

function LeaveTab({ branchId }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranchLeave(branchId, page, 10)
      .then(({ data }) => !cancelled && setData(data))
      .catch(
        () =>
          !cancelled &&
          setError("Couldn't load leave requests for this branch."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, page]);

  if (loading && !data) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) return <div className={styles.tabError}>{error}</div>;

  const requests = data?.content || [];

  if (requests.length === 0) {
    return (
      <div className={styles.emptyMini}>
        <i className="ti ti-beach" aria-hidden="true" />
        <p>No leave requests recorded for this branch yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.employeesWrap}>
      <div className={styles.employeeTable}>
        {requests.map((l) => (
          <div key={l.id} className={styles.leaveRow}>
            <span className={styles.employeeAvatar}>
              {nameInitials(
                `${l.employeeFirstName || ""} ${l.employeeLastName || ""}`,
              )}
            </span>
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>
                {l.employeeFirstName} {l.employeeLastName}
              </span>
              <span className={styles.employeeMeta}>
                {l.leaveType?.replaceAll("_", " ")} · {l.startDate} →{" "}
                {l.endDate} · {l.days}d
              </span>
            </div>
            <span
              className={`${styles.leaveStatusBadge} ${leaveStatusClass(l.status)}`}
            >
              {LEAVE_STATUS_LABELS[l.status] || l.status}
            </span>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function formatMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function PayrollTab({ branchId }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranchPayroll(branchId, page, 10)
      .then(({ data }) => !cancelled && setData(data))
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setForbidden(true);
        } else {
          setError("Couldn't load payroll records for this branch.");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branchId, page]);

  if (loading && !data) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={styles.emptyMini}>
        <i className="ti ti-lock" aria-hidden="true" />
        <p>Only business admins can view branch payroll records.</p>
      </div>
    );
  }

  if (error) return <div className={styles.tabError}>{error}</div>;

  const records = data?.content || [];

  if (records.length === 0) {
    return (
      <div className={styles.emptyMini}>
        <i className="ti ti-cash-off" aria-hidden="true" />
        <p>No payroll records finalized for this branch yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.employeesWrap}>
      <div className={styles.employeeTable}>
        {records.map((p, idx) => (
          <div key={idx} className={styles.payrollRow}>
            <span className={styles.employeeAvatar}>
              {nameInitials(`${p.firstName || ""} ${p.lastName || ""}`)}
            </span>
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>
                {p.firstName} {p.lastName}
              </span>
              <span className={styles.employeeMeta}>
                {p.periodStart} → {p.periodEnd}
              </span>
            </div>
            <div className={styles.payrollFigures}>
              <span className={styles.payrollNet}>{formatMoney(p.netPay)}</span>
              <span className={styles.payrollDeduction}>
                −{formatMoney(p.totalDeduction)} deducted
              </span>
            </div>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function BranchDetail({ branch, onBack, onEdit, toast }) {
  const [tab, setTab] = useState("overview");

  if (!branch) return null;

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Back to branches
      </button>

      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>
            <i className="ti ti-building-store" aria-hidden="true" />
          </span>
          <div>
            <div className={styles.headerNameRow}>
              <h2 className={styles.headerName}>{branch.name}</h2>
              {branch.code && (
                <span className={styles.codeBadge}>{branch.code}</span>
              )}
              <span
                className={`${styles.statusBadge} ${branch.status === "ACTIVE" ? styles.statusActive : styles.statusInactive}`}
              >
                {branch.status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
            </div>
            {branch.managerName ? (
              <span className={styles.managerLine}>
                <i className="ti ti-user-star" aria-hidden="true" /> Managed by{" "}
                {branch.managerName}
              </span>
            ) : (
              <span className={`${styles.managerLine} ${styles.noManagerLine}`}>
                No manager assigned
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => onEdit(branch)}
        >
          <i className="ti ti-pencil" aria-hidden="true" /> Edit branch
        </button>
      </div>

      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === "overview" && <OverviewTab branchId={branch.id} />}
        {tab === "employees" && (
          <EmployeesTab
            branchId={branch.id}
            branchName={branch.name}
            toast={toast}
          />
        )}
        {tab === "attendance" && <AttendanceTab branchId={branch.id} />}
        {tab === "leave" && <LeaveTab branchId={branch.id} />}
        {tab === "payroll" && <PayrollTab branchId={branch.id} />}
        {tab === "qr" && (
          <div className={styles.qrTabStack}>
            <BranchQrPanel branchId={branch.id} branchStatus={branch.status} />
            <BranchQrDisplayLinkPanel
              branchId={branch.id}
              branchStatus={branch.status}
            />
            <BranchAttendanceSettingsPanel branchId={branch.id} />
          </div>
        )}
      </div>
    </div>
  );
}
