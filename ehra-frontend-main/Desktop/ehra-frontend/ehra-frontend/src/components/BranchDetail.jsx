import { useState, useEffect, useCallback } from "react";
import { getBranchDashboard, getBranchEmployees } from "../api/branchApi";
import BranchQrPanel from "./BranchQrPanel";
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

function EmployeesTab({ branchId }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  }, [branchId, page]);

  if (loading && !data) {
    return (
      <div className={styles.tabLoading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) return <div className={styles.tabError}>{error}</div>;

  const employees = data?.content || [];

  if (employees.length === 0) {
    return (
      <div className={styles.emptyMini}>
        <i className="ti ti-user-off" aria-hidden="true" />
        <p>No employees assigned to this branch yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.employeesWrap}>
      <div className={styles.employeeTable}>
        {employees.map((emp) => (
          <div key={emp.id} className={styles.employeeRow}>
            <span className={styles.employeeAvatar}>
              {nameInitials(`${emp.firstName || ""} ${emp.lastName || ""}`)}
            </span>
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>
                {emp.firstName} {emp.lastName}
              </span>
              <span className={styles.employeeMeta}>{emp.email}</span>
            </div>
            <span className={styles.employeePosition}>
              {emp.position || "—"}
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

export default function BranchDetail({ branch, onBack, onEdit }) {
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
        {tab === "employees" && <EmployeesTab branchId={branch.id} />}
        {tab === "qr" && (
          <BranchQrPanel branchId={branch.id} branchStatus={branch.status} />
        )}
      </div>
    </div>
  );
}
