import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/authApi";
import {
  softDeleteEmployee,
  getTrashedEmployees,
  restoreEmployee,
} from "../api/workforceApi";
import DepartmentCell from "./DepartmentCell";
import PositionCell from "./PositionCell";
import HireDateCell from "./HireDateCell";
import EmploymentTypeCell from "./EmploymentTypeCell";
import SalaryCell from "./SalaryCell";
import RemoveEmployeeModal from "./RemoveEmployeeModal";
import QuickSendMessageModal from "./QuickSendMessageModal";
import styles from "./WorkforceTab.module.css";

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

const STATUS_STYLE = {
  ACTIVE: { label: "Active", cls: "pillActive" },
  PENDING_APPROVAL: { label: "Pending", cls: "pillPending" },
  REJECTED: { label: "Rejected", cls: "pillRejected" },
  SUSPENDED: { label: "Suspended", cls: "pillSuspended" },
};

export default function WorkforceTab({ departments }) {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [confirm, setConfirm] = useState(null); // { emp, action }
  const [actioning, setActioning] = useState(null);
  const [messageTarget, setMessageTarget] = useState(null); // employee to message, mobile-only shortcut

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [dirRes, trashRes] = await Promise.all([
        API.get("/employees/directory"),
        getTrashedEmployees(),
      ]);
      setEmployees(dirRes.data.filter((e) => !e.deletedAt));
      setTrashed(trashRes.data);
    } catch (err) {
      console.error("Failed to load workforce:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const handleSoftDelete = async () => {
    if (!confirm) return;
    setActioning(confirm.emp.id);
    try {
      await softDeleteEmployee(confirm.emp.id);
      await fetchAll();
    } catch {
      alert("Failed to remove employee.");
    } finally {
      setActioning(null);
      setConfirm(null);
    }
  };

  const handleRestore = async (emp) => {
    setActioning(emp.id);
    try {
      await restoreEmployee(emp.id);
      await fetchAll();
    } catch {
      alert("Failed to restore employee.");
    } finally {
      setActioning(null);
    }
  };

  const handleDeptAssigned = (id, updated) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

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

  const handleSalaryAssigned = (id, updated) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Workforce</h2>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search name, email, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`${styles.trashToggle} ${showTrash ? styles.trashActive : ""}`}
            onClick={() => setShowTrash((v) => !v)}
          >
            <i className="ti ti-trash" aria-hidden="true" />
            Trash{" "}
            {trashed.length > 0 && (
              <span className={styles.trashBadge}>{trashed.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main list ── */}
      {!showTrash && (
        <>
          {loading ? (
            <div className={styles.empty}>Loading employees…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              {employees.length === 0
                ? "No employees yet. Send an invitation to get started."
                : "No employees match your search."}
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((emp) => {
                const statusStyle =
                  STATUS_STYLE[emp.status] || STATUS_STYLE.ACTIVE;
                const name = [emp.firstName, emp.lastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={emp.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.avatarGroup}>
                        <div className={styles.avatar}>
                          {emp.profilePictureUrl ? (
                            <img src={emp.profilePictureUrl} alt={name} />
                          ) : (
                            initials(emp.firstName, emp.lastName)
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.messageIconBtn}
                          onClick={() => setMessageTarget(emp)}
                          title={`Message ${name || "employee"}`}
                          aria-label={`Message ${name || "employee"}`}
                        >
                          <i
                            className="ti ti-message-circle"
                            aria-hidden="true"
                          />
                        </button>
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
                      {emp.phone && (
                        <p className={styles.empPhone}>{emp.phone}</p>
                      )}

                      <div className={styles.deptRow}>
                        <i
                          className="ti ti-building"
                          style={{ fontSize: 12 }}
                          aria-hidden="true"
                        />
                        <DepartmentCell
                          employee={emp}
                          departments={departments}
                          onAssigned={handleDeptAssigned}
                        />
                      </div>

                      <div className={styles.deptRow}>
                        <i
                          className="ti ti-briefcase"
                          style={{ fontSize: 12 }}
                          aria-hidden="true"
                        />
                        <PositionCell
                          employee={emp}
                          mode="employer"
                          onAssigned={handlePositionAssigned}
                        />
                      </div>

                      <div className={styles.deptRow}>
                        <i
                          className="ti ti-calendar-event"
                          style={{ fontSize: 12 }}
                          aria-hidden="true"
                        />
                        <HireDateCell
                          employee={emp}
                          mode="employer"
                          onAssigned={handleHireDateAssigned}
                        />
                      </div>

                      {/* <p className={styles.role}>{emp.role}</p> */}

                      <div className={styles.deptRow}>
                        <EmploymentTypeCell
                          employee={emp}
                          mode="employer"
                          onAssigned={handleEmploymentTypeAssigned}
                        />
                      </div>

                      <div
                        className={`${styles.deptRow} ${styles.salaryRowMobile}`}
                      >
                        <SalaryCell
                          employee={emp}
                          onAssigned={handleSalaryAssigned}
                        />
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.viewBtn}
                        onClick={() =>
                          navigate(`/employees/${emp.id}`, {
                            state: { from: "Workforce" },
                          })
                        }
                      >
                        <i className="ti ti-user" aria-hidden="true" /> View
                        profile
                      </button>
                      <button
                        className={styles.removeBtn}
                        onClick={() => setConfirm({ emp, action: "delete" })}
                        disabled={actioning === emp.id}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Trash ── */}
      {showTrash && (
        <div className={styles.trashSection}>
          <div className={styles.trashHeader}>
            <i className="ti ti-trash" aria-hidden="true" />
            <span>Employees in trash — permanently deleted after 7 days</span>
          </div>
          {trashed.length === 0 ? (
            <div className={styles.empty}>Trash is empty.</div>
          ) : (
            <div className={styles.trashList}>
              {trashed.map((emp) => {
                const name = [emp.firstName, emp.lastName]
                  .filter(Boolean)
                  .join(" ");
                const deletedAt = emp.deletedAt
                  ? new Date(emp.deletedAt).toLocaleDateString()
                  : "—";
                const daysLeft = emp.deletedAt
                  ? Math.max(
                      0,
                      7 -
                        Math.floor(
                          (Date.now() - new Date(emp.deletedAt).getTime()) /
                            86400000,
                        ),
                    )
                  : 7;

                return (
                  <div key={emp.id} className={styles.trashItem}>
                    <div className={styles.avatar} style={{ opacity: 0.5 }}>
                      {emp.profilePictureUrl ? (
                        <img src={emp.profilePictureUrl} alt={name} />
                      ) : (
                        initials(emp.firstName, emp.lastName)
                      )}
                    </div>
                    <div className={styles.trashInfo}>
                      <p className={styles.empName}>{name}</p>
                      <p className={styles.empEmail}>{emp.email}</p>
                      <p className={styles.trashMeta}>
                        Moved to trash on {deletedAt} ·{" "}
                        <span
                          style={{
                            color:
                              daysLeft <= 2
                                ? "var(--danger-text)"
                                : "var(--text-secondary)",
                          }}
                        >
                          {daysLeft} day{daysLeft !== 1 ? "s" : ""} until
                          permanent deletion
                        </span>
                      </p>
                    </div>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => handleRestore(emp)}
                      disabled={actioning === emp.id}
                    >
                      {actioning === emp.id ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      <RemoveEmployeeModal
        employee={confirm?.emp}
        loading={!!actioning}
        onCancel={() => setConfirm(null)}
        onConfirm={handleSoftDelete}
      />

      {/* ── Personal message modal (mobile shortcut from the avatar) ── */}
      <QuickSendMessageModal
        open={!!messageTarget}
        onClose={() => setMessageTarget(null)}
        employees={employees}
        initialRecipientId={messageTarget?.id}
      />
    </div>
  );
}
