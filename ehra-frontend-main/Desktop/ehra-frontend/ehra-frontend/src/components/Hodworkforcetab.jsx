import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/authApi";
import PositionCell from "./PositionCell";
import HireDateCell from "./HireDateCell";
import EmploymentTypeCell from "./EmploymentTypeCell";
import styles from "./WorkforceTab.module.css"; // reuse employer's stylesheet

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

const STATUS_STYLE = {
  ACTIVE: { label: "Active", cls: "pillActive" },
  PENDING_APPROVAL: { label: "Pending", cls: "pillPending" },
  REJECTED: { label: "Rejected", cls: "pillRejected" },
  SUSPENDED: { label: "Suspended", cls: "pillSuspended" },
};

/**
 * HodWorkforceTab — read-only workforce view for Heads of Department.
 *
 * Differences from WorkforceTab (employer):
 *  • Only shows employees in the HOD's own department(s) via GET /api/employees/my-department
 *  • No trash / soft-delete / restore actions
 *  • No DepartmentCell reassignment
 *  • Can assign/change an employee's position (job title) via PositionCell —
 *    the change is submitted for the employer's approval, it isn't applied
 *    immediately (see PositionCell mode="hod")
 *  • No "Send message" button on profile page (navigates to profile but
 *    the view prop `hodView` is passed via URL state so EmployeeProfilePage
 *    can hide the messaging UI — see EmployeeProfilePage.jsx)
 */
export default function HodWorkforceTab() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/employees/my-department");
      setEmployees(data);
    } catch (err) {
      console.error("Failed to load department employees:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handlePositionAssigned = (id, updated) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

  const handleEmploymentTypeAssigned = (id, updated) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

  const handleHireDateAssigned = (id, updated) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

  const filtered = employees.filter((e) => {
    const name = `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase();
    const dept = (e.department || "").toLowerCase();
    const term = search.toLowerCase();
    return (
      name.includes(term) ||
      dept.includes(term) ||
      (e.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>My Department</h2>
          <p className={styles.sub}>
            {employees.length} employee{employees.length !== 1 ? "s" : ""} in
            your department
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Employee grid ── */}
      {loading ? (
        <div className={styles.empty}>Loading department…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {employees.length === 0
            ? "No employees are assigned to your department yet."
            : "No employees match your search."}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((emp) => {
            const statusStyle = STATUS_STYLE[emp.status] || STATUS_STYLE.ACTIVE;
            const name = [emp.firstName, emp.lastName]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={emp.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {emp.profilePictureUrl ? (
                      <img src={emp.profilePictureUrl} alt={name} />
                    ) : (
                      initials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  <span
                    className={`${styles.statusPill} ${styles[statusStyle.cls]}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.empName}>{name || "—"}</p>
                  <p className={styles.empEmail}>{emp.email}</p>
                  {emp.phone && <p className={styles.empPhone}>{emp.phone}</p>}
                  <div className={styles.deptRow}>
                    <i
                      className="ti ti-building"
                      style={{ fontSize: 12 }}
                      aria-hidden="true"
                    />
                    <span
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {emp.department}
                    </span>
                  </div>
                  <div className={styles.deptRow}>
                    <i
                      className="ti ti-briefcase"
                      style={{ fontSize: 12 }}
                      aria-hidden="true"
                    />
                    <PositionCell
                      employee={emp}
                      mode="hod"
                      onAssigned={handlePositionAssigned}
                    />
                  </div>
                  <p className={styles.role}>{emp.role}</p>

                  <div className={styles.deptRow}>
                    <i
                      className="ti ti-calendar-event"
                      style={{ fontSize: 12 }}
                      aria-hidden="true"
                    />
                    <HireDateCell
                      employee={emp}
                      mode="hod"
                      onAssigned={handleHireDateAssigned}
                    />
                  </div>

                  <div className={styles.deptRow}>
                    <EmploymentTypeCell
                      employee={emp}
                      mode="hod"
                      onAssigned={handleEmploymentTypeAssigned}
                    />
                  </div>
                </div>

                {/* View profile only — no remove/trash/message actions */}
                <div className={styles.cardActions}>
                  <button
                    className={styles.viewBtn}
                    style={{ flex: 1 }}
                    onClick={() =>
                      navigate(`/employees/${emp.id}`, {
                        state: { hodView: true, from: "Workforce" },
                      })
                    }
                  >
                    <i className="ti ti-user" aria-hidden="true" /> View profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
