import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/authApi";
import {
  getDepartments,
  assignEmployeeDepartment,
  deleteDepartment,
} from "../api/departmentApi";
import { getAccessToken } from "../api/authApi";
import styles from "./DepartmentsTab.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(" ") || "—";
}

function deptColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsl(${hue},60%,92%)`, accent: `hsl(${hue},55%,40%)` };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className={styles.toastStack}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[`toast_${t.type}`]}`}
        >
          <i
            className={`ti ${t.type === "error" ? "ti-alert-circle" : "ti-circle-check"}`}
            aria-hidden="true"
          />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3500,
    );
  }, []);

  return { toasts, push };
}

// ── HOD Picker Modal ──────────────────────────────────────────────────────────

function HodPickerModal({
  department,
  candidates,
  onClose,
  onAssigned,
  toast,
}) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const filtered = candidates.filter((e) => {
    const term = search.toLowerCase();
    return (
      fullName(e).toLowerCase().includes(term) ||
      (e.email || "").toLowerCase().includes(term) ||
      (e.role || "").toLowerCase().includes(term)
    );
  });

  const handlePick = async (emp) => {
    setSaving(emp?.id ?? "none");
    try {
      const hodId = emp ? emp.id : null;
      const { data } = await API.put(`/departments/${department.id}`, {
        hodId,
      });
      onAssigned(department.id, data);
      toast(
        emp
          ? `${fullName(emp)} set as HOD of ${department.name}`
          : "HOD removed",
        "success",
      );
      onClose();
    } catch {
      toast("Failed to assign HOD. Please try again.", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.hodModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.hodModalHeader}>
          <div>
            <p className={styles.hodModalSub}>Head of Department</p>
            <h3 className={styles.hodModalTitle}>{department.name}</h3>
          </div>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.hodSearch}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.hodList}>
          <button
            className={`${styles.hodOption} ${!department.hodId ? styles.hodOptionActive : ""}`}
            onClick={() => handlePick(null)}
            disabled={saving !== null}
          >
            <div className={`${styles.hodAvatar} ${styles.hodAvatarNone}`}>
              <i className="ti ti-user-off" aria-hidden="true" />
            </div>
            <div className={styles.hodOptionInfo}>
              <span className={styles.hodOptionName}>No HOD assigned</span>
              <span className={styles.hodOptionRole}>
                Remove current assignment
              </span>
            </div>
            {saving === "none" ? (
              <div className={styles.hodSpinner} />
            ) : (
              !department.hodId && (
                <i className="ti ti-check" aria-hidden="true" />
              )
            )}
          </button>

          {filtered.length === 0 && search ? (
            <p className={styles.hodEmpty}>No employees match "{search}"</p>
          ) : (
            filtered.map((emp) => {
              const isHod = department.hodId === emp.id;
              return (
                <button
                  key={emp.id}
                  className={`${styles.hodOption} ${isHod ? styles.hodOptionActive : ""}`}
                  onClick={() => handlePick(emp)}
                  disabled={saving !== null}
                >
                  <div className={styles.hodAvatar}>
                    {emp.profilePictureUrl ? (
                      <img src={emp.profilePictureUrl} alt={fullName(emp)} />
                    ) : (
                      initials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  <div className={styles.hodOptionInfo}>
                    <span className={styles.hodOptionName}>
                      {fullName(emp)}
                    </span>
                    <span className={styles.hodOptionRole}>
                      {emp.role || emp.email}
                    </span>
                  </div>
                  {saving === emp.id ? (
                    <div className={styles.hodSpinner} />
                  ) : (
                    isHod && <i className="ti ti-check" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────

function EmployeeCard({
  emp,
  departments,
  isHod,
  onViewProfile,
  onMoveDept,
  toast,
}) {
  const [deptOpen, setDeptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // dropUp: true = open upward, false = open downward
  const [dropUp, setDropUp] = useState(false);
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function outside(e) {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      ) {
        setDeptOpen(false);
      }
    }
    if (deptOpen) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [deptOpen]);

  const handleToggle = () => {
    if (!deptOpen && btnRef.current) {
      // Decide direction before opening
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220);
    }
    setDeptOpen((v) => !v);
  };

  const handleMove = async (deptId) => {
    setDeptOpen(false);
    setSaving(true);
    try {
      const { data } = await assignEmployeeDepartment(emp.id, deptId);
      onMoveDept(emp.id, data);
      const label = deptId
        ? departments.find((d) => d.id === deptId)?.name || "department"
        : "Unassigned";
      toast(`${fullName(emp)} moved to ${label}`, "success");
    } catch {
      toast("Failed to move employee. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.empCard} ${isHod ? styles.empCardHod : ""}`}>
      {isHod && (
        <span className={styles.hodBadge}>
          <i className="ti ti-crown" aria-hidden="true" /> HOD
        </span>
      )}

      <div className={styles.empCardLeft}>
        <div className={styles.empAvatar}>
          {emp.profilePictureUrl ? (
            <img src={emp.profilePictureUrl} alt={fullName(emp)} />
          ) : (
            initials(emp.firstName, emp.lastName)
          )}
        </div>
        <div className={styles.empInfo}>
          <p className={styles.empName}>{fullName(emp)}</p>
          <p className={styles.empRole}>{emp.role || emp.email}</p>
        </div>
      </div>

      <div className={styles.empCardActions}>
        {/* Move dept */}
        <div className={styles.moveDeptWrap}>
          <button
            ref={btnRef}
            className={styles.actionBtn}
            title="Move to department"
            onClick={handleToggle}
            disabled={saving}
          >
            {saving ? (
              <i
                className="ti ti-loader-2"
                style={{ animation: "spin 1s linear infinite" }}
                aria-hidden="true"
              />
            ) : (
              <i className="ti ti-arrows-transfer-up" aria-hidden="true" />
            )}
          </button>

          {deptOpen && (
            <div
              ref={dropRef}
              className={`${styles.moveDeptDropdown} ${dropUp ? styles.moveDeptDropdownUp : ""}`}
            >
              <p className={styles.moveDeptLabel}>Move to</p>
              <button
                className={styles.moveDeptOption}
                onClick={() => handleMove(null)}
              >
                <span
                  className={styles.moveDeptDot}
                  style={{ background: "var(--border-color)" }}
                />
                Unassigned
              </button>
              {departments.map((d) =>
                d.id !== emp.departmentId ? (
                  <button
                    key={d.id}
                    className={styles.moveDeptOption}
                    onClick={() => handleMove(d.id)}
                  >
                    <span
                      className={styles.moveDeptDot}
                      style={{ background: "var(--accent)" }}
                    />
                    {d.name}
                  </button>
                ) : null,
              )}
            </div>
          )}
        </div>

        {/* View profile */}
        <button
          className={styles.actionBtnPrimary}
          title="View profile"
          onClick={() => onViewProfile(emp.id)}
        >
          <i className="ti ti-user" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteDeptModal({ dept, onClose, onDeleted, toast }) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDepartment(dept.id);
      onDeleted(dept.id);
      toast(`"${dept.name}" deleted`, "success");
      onClose();
    } catch {
      toast("Failed to delete department. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.deleteIcon}>
          <i className="ti ti-trash" aria-hidden="true" />
        </div>
        <h3 className={styles.deleteTitle}>Delete "{dept.name}"?</h3>
        <p className={styles.deleteSub}>
          Employees in this department will become unassigned. This action
          cannot be undone.
        </p>
        <div className={styles.deleteActions}>
          <button
            className={styles.deleteCancelBtn}
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className={styles.deleteConfirmBtn}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <div className={styles.btnSpinner} /> Deleting…
              </>
            ) : (
              "Yes, delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Department Modal ──────────────────────────────────────────────────────

function AddDeptModal({ employees, onClose, onCreated, toast }) {
  const [name, setName] = useState("");
  const [hodId, setHodId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Department name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await API.post("/departments", {
        name: trimmed,
        hodId: hodId ? Number(hodId) : null,
      });
      onCreated(data);
      toast(`"${trimmed}" department created`, "success");
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create department.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.addDeptModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.hodModalHeader}>
          <div>
            <p className={styles.hodModalSub}>Create new</p>
            <h3 className={styles.hodModalTitle}>Add Department</h3>
          </div>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleCreate} className={styles.addDeptForm}>
          <div className={styles.addDeptField}>
            <label className={styles.addDeptLabel}>Department name</label>
            <input
              ref={inputRef}
              className={styles.addDeptInput}
              type="text"
              placeholder="e.g. Engineering, Marketing…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </div>

          <div className={styles.addDeptField}>
            <label className={styles.addDeptLabel}>
              Head of Department{" "}
              <span className={styles.optional}>(optional)</span>
            </label>
            <select
              className={styles.addDeptSelect}
              value={hodId}
              onChange={(e) => setHodId(e.target.value)}
            >
              <option value="">No HOD assigned</option>
              {employees
                .filter((e) => e.status === "ACTIVE")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e)}
                  </option>
                ))}
            </select>
          </div>

          {error && (
            <p className={styles.addDeptError}>
              <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
            </p>
          )}

          <div className={styles.addDeptActions}>
            <button
              type="button"
              className={styles.addDeptCancel}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.addDeptSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className={styles.btnSpinner} /> Creating…
                </>
              ) : (
                "Create department"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main DepartmentsTab ───────────────────────────────────────────────────────

export default function DepartmentsTab() {
  const navigate = useNavigate();
  const { toasts, push: toast } = useToast();

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsedDepts, setCollapsedDepts] = useState({});
  const [pulseId, setPulseId] = useState(null);

  const [hodPicker, setHodPicker] = useState(null);
  const [deleteDept, setDeleteDept] = useState(null);
  const [addDeptOpen, setAddDeptOpen] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [deptRes, dirRes] = await Promise.all([
        getDepartments(),
        API.get("/employees/directory"),
      ]);
      setDepartments(deptRes.data);
      setEmployees(dirRes.data.filter((e) => !e.deletedAt));
    } catch (err) {
      console.error("DepartmentsTab: failed to fetch:", err);
      toast("Failed to load departments. Check your connection.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Real-time SSE ─────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const handleDeptUpdate = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "CREATED") {
          setDepartments((prev) => [...prev, payload.department]);
          setPulseId(payload.department?.id);
          setTimeout(() => setPulseId(null), 2000);
        } else if (payload.type === "UPDATED") {
          setDepartments((prev) =>
            prev.map((d) =>
              d.id === payload.department?.id ? payload.department : d,
            ),
          );
          setPulseId(payload.department?.id);
          setTimeout(() => setPulseId(null), 2000);
        } else if (payload.type === "DELETED") {
          setDepartments((prev) =>
            prev.filter((d) => d.id !== payload.departmentId),
          );
        }
      } catch {
        /* ignore */
      }
    };

    const handleEmployeeUpdate = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === payload.id ? { ...emp, ...payload } : emp,
          ),
        );
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("department_update", handleDeptUpdate);
    es.addEventListener("employee_update", handleEmployeeUpdate);
    es.onerror = () =>
      console.debug("[SSE] DepartmentsTab stream error, reconnecting…");

    return () => es.close();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeptCreated = (dept) => {
    setDepartments((prev) => [...prev, dept]);
    setPulseId(dept.id);
    setTimeout(() => setPulseId(null), 2000);
  };

  const handleHodAssigned = (deptId, updatedDept) => {
    setDepartments((prev) =>
      prev.map((d) => (d.id === deptId ? updatedDept : d)),
    );
    setPulseId(deptId);
    setTimeout(() => setPulseId(null), 2000);
  };

  const handleDeptDeleted = (deptId) => {
    setDepartments((prev) => prev.filter((d) => d.id !== deptId));
  };

  const handleEmployeeMoved = (empId, updatedEmp) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === empId ? { ...e, ...updatedEmp } : e)),
    );
    setPulseId(updatedEmp?.departmentId || "unassigned");
    setTimeout(() => setPulseId(null), 1500);
  };

  const toggleCollapse = (id) =>
    setCollapsedDepts((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Derived data ──────────────────────────────────────────────────────────

  const term = search.toLowerCase();

  const empsByDept = {};
  const unassigned = [];
  for (const emp of employees) {
    if (emp.departmentId) {
      (empsByDept[emp.departmentId] = empsByDept[emp.departmentId] || []).push(
        emp,
      );
    } else {
      unassigned.push(emp);
    }
  }

  const filteredDepts = departments.filter((d) => {
    if (!term) return true;
    const emps = empsByDept[d.id] || [];
    return (
      d.name.toLowerCase().includes(term) ||
      emps.some(
        (e) =>
          fullName(e).toLowerCase().includes(term) ||
          (e.email || "").toLowerCase().includes(term),
      )
    );
  });

  const filteredUnassigned = unassigned.filter(
    (e) =>
      !term ||
      fullName(e).toLowerCase().includes(term) ||
      (e.email || "").toLowerCase().includes(term),
  );

  const totalAssigned = employees.length - unassigned.length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading departments…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Departments</h2>
          <div className={styles.headerMeta}>
            <span className={styles.metaPill}>
              <i className="ti ti-building" aria-hidden="true" />
              {departments.length} dept{departments.length !== 1 ? "s" : ""}
            </span>
            <span className={styles.metaPill}>
              <i className="ti ti-users" aria-hidden="true" />
              {totalAssigned} assigned
            </span>
            {unassigned.length > 0 && (
              <span className={`${styles.metaPill} ${styles.metaPillWarn}`}>
                <i className="ti ti-user-question" aria-hidden="true" />
                {unassigned.length} unassigned
              </span>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search departments or employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={styles.clearSearch}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            className={styles.addBtn}
            onClick={() => setAddDeptOpen(true)}
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span>Add department</span>
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {departments.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <i className="ti ti-building" aria-hidden="true" />
          </div>
          <h3>No departments yet</h3>
          <p>
            Create your first department to start organizing your workforce.
          </p>
          <button
            className={styles.addBtn}
            onClick={() => setAddDeptOpen(true)}
          >
            <i className="ti ti-plus" aria-hidden="true" /> Create department
          </button>
        </div>
      )}

      {/* ── Department groups ── */}
      <div className={styles.groups}>
        {filteredDepts.map((dept) => {
          const { accent } = deptColor(dept.name);
          const deptEmps = empsByDept[dept.id] || [];
          const hod = dept.hodId
            ? deptEmps.find((e) => e.id === dept.hodId)
            : null;
          const isCollapsed = collapsedDepts[dept.id];
          const isPulsing = pulseId === dept.id;

          const sorted = [...deptEmps].sort((a, b) => {
            if (a.id === dept.hodId) return -1;
            if (b.id === dept.hodId) return 1;
            return fullName(a).localeCompare(fullName(b));
          });

          return (
            <div
              key={dept.id}
              className={`${styles.deptGroup} ${isPulsing ? styles.pulse : ""}`}
            >
              <div
                className={styles.deptHeader}
                style={{ borderLeftColor: accent }}
              >
                <div
                  className={styles.deptHeaderLeft}
                  onClick={() => toggleCollapse(dept.id)}
                >
                  <div
                    className={styles.deptColorDot}
                    style={{ background: accent }}
                  />
                  <div>
                    <h3 className={styles.deptName}>{dept.name}</h3>
                    <p className={styles.deptMeta}>
                      {deptEmps.length} member{deptEmps.length !== 1 ? "s" : ""}
                      {hod && (
                        <>
                          {" "}
                          ·{" "}
                          <span className={styles.hodChip}>
                            <i className="ti ti-crown" aria-hidden="true" />{" "}
                            {fullName(hod)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className={styles.deptActions}>
                  <button
                    className={styles.deptAction}
                    title="Assign HOD"
                    onClick={() => setHodPicker(dept)}
                  >
                    <i className="ti ti-crown" aria-hidden="true" />
                    <span>Set HOD</span>
                  </button>
                  <button
                    className={`${styles.deptAction} ${styles.deptActionDanger}`}
                    title="Delete department"
                    onClick={() => setDeleteDept(dept)}
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                  <button
                    className={`${styles.deptAction} ${styles.collapseBtn}`}
                    onClick={() => toggleCollapse(dept.id)}
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    <i
                      className={`ti ${isCollapsed ? "ti-chevron-down" : "ti-chevron-up"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className={styles.deptBody}>
                  {sorted.length === 0 ? (
                    <div className={styles.deptEmpty}>
                      <i className="ti ti-users-group" aria-hidden="true" />
                      <span>No employees assigned to this department yet.</span>
                    </div>
                  ) : (
                    <div className={styles.empList}>
                      {sorted.map((emp) => (
                        <EmployeeCard
                          key={emp.id}
                          emp={emp}
                          departments={departments}
                          isHod={emp.id === dept.hodId}
                          onViewProfile={(id) =>
                            navigate(`/employees/${id}`, {
                              state: { from: "Departments" },
                            })
                          }
                          onMoveDept={handleEmployeeMoved}
                          toast={toast}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isCollapsed && deptEmps.length > 0 && (
                <div
                  className={styles.collapsedSummary}
                  onClick={() => toggleCollapse(dept.id)}
                >
                  <div className={styles.collapsedAvatars}>
                    {sorted.slice(0, 5).map((e) => (
                      <div
                        key={e.id}
                        className={styles.collapsedAvatar}
                        title={fullName(e)}
                      >
                        {e.profilePictureUrl ? (
                          <img src={e.profilePictureUrl} alt={fullName(e)} />
                        ) : (
                          initials(e.firstName, e.lastName)
                        )}
                      </div>
                    ))}
                    {sorted.length > 5 && (
                      <div
                        className={`${styles.collapsedAvatar} ${styles.collapsedAvatarMore}`}
                      >
                        +{sorted.length - 5}
                      </div>
                    )}
                  </div>
                  <span className={styles.collapsedHint}>Click to expand</span>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Unassigned ── */}
        {filteredUnassigned.length > 0 && (
          <div
            className={`${styles.deptGroup} ${styles.deptGroupUnassigned} ${pulseId === "unassigned" ? styles.pulse : ""}`}
          >
            <div
              className={`${styles.deptHeader} ${styles.deptHeaderUnassigned}`}
            >
              <div
                className={styles.deptHeaderLeft}
                onClick={() => toggleCollapse("__unassigned__")}
              >
                <div
                  className={styles.deptColorDot}
                  style={{ background: "var(--text-secondary)" }}
                />
                <div>
                  <h3 className={styles.deptName}>Unassigned</h3>
                  <p className={styles.deptMeta}>
                    {filteredUnassigned.length} employee
                    {filteredUnassigned.length !== 1 ? "s" : ""} without a
                    department
                  </p>
                </div>
              </div>
              <button
                className={`${styles.deptAction} ${styles.collapseBtn}`}
                onClick={() => toggleCollapse("__unassigned__")}
                aria-label={
                  collapsedDepts["__unassigned__"] ? "Expand" : "Collapse"
                }
              >
                <i
                  className={`ti ${collapsedDepts["__unassigned__"] ? "ti-chevron-down" : "ti-chevron-up"}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {!collapsedDepts["__unassigned__"] && (
              <div className={styles.deptBody}>
                <div className={styles.empList}>
                  {filteredUnassigned
                    .sort((a, b) => fullName(a).localeCompare(fullName(b)))
                    .map((emp) => (
                      <EmployeeCard
                        key={emp.id}
                        emp={emp}
                        departments={departments}
                        isHod={false}
                        onViewProfile={(id) =>
                          navigate(`/employees/${id}`, {
                            state: { from: "Departments" },
                          })
                        }
                        onMoveDept={handleEmployeeMoved}
                        toast={toast}
                      />
                    ))}
                </div>
              </div>
            )}

            {collapsedDepts["__unassigned__"] &&
              filteredUnassigned.length > 0 && (
                <div
                  className={styles.collapsedSummary}
                  onClick={() => toggleCollapse("__unassigned__")}
                >
                  <div className={styles.collapsedAvatars}>
                    {filteredUnassigned.slice(0, 5).map((e) => (
                      <div
                        key={e.id}
                        className={styles.collapsedAvatar}
                        title={fullName(e)}
                      >
                        {e.profilePictureUrl ? (
                          <img src={e.profilePictureUrl} alt={fullName(e)} />
                        ) : (
                          initials(e.firstName, e.lastName)
                        )}
                      </div>
                    ))}
                    {filteredUnassigned.length > 5 && (
                      <div
                        className={`${styles.collapsedAvatar} ${styles.collapsedAvatarMore}`}
                      >
                        +{filteredUnassigned.length - 5}
                      </div>
                    )}
                  </div>
                  <span className={styles.collapsedHint}>Click to expand</span>
                </div>
              )}
          </div>
        )}

        {/* No results */}
        {departments.length > 0 &&
          filteredDepts.length === 0 &&
          filteredUnassigned.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <i className="ti ti-search" aria-hidden="true" />
              </div>
              <h3>No results for "{search}"</h3>
              <p>Try a different name or clear the search.</p>
            </div>
          )}
      </div>

      {/* ── Modals ── */}
      {hodPicker && (
        <HodPickerModal
          department={hodPicker}
          candidates={employees.filter((e) => e.status === "ACTIVE")}
          onClose={() => setHodPicker(null)}
          onAssigned={handleHodAssigned}
          toast={toast}
        />
      )}

      {deleteDept && (
        <DeleteDeptModal
          dept={deleteDept}
          onClose={() => setDeleteDept(null)}
          onDeleted={handleDeptDeleted}
          toast={toast}
        />
      )}

      {addDeptOpen && (
        <AddDeptModal
          employees={employees}
          onClose={() => setAddDeptOpen(false)}
          onCreated={handleDeptCreated}
          toast={toast}
        />
      )}
    </div>
  );
}
