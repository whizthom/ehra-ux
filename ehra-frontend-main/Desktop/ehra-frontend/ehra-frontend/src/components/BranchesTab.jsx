import { useState, useEffect, useCallback, useRef } from "react";
import API from "../api/authApi";
import {
  getBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
  deleteBranch,
} from "../api/branchApi";
import styles from "./BranchesTab.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(" ") || "—";
}

function locationLine(b) {
  return [b.address, b.city, b.state, b.country].filter(Boolean).join(", ");
}

// ── Toast ─────────────────────────────────────────────────────────────────

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

// ── Add / Edit Branch Modal ──────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  address: "",
  city: "",
  state: "",
  country: "",
  phone: "",
  email: "",
  managerId: "",
};

function BranchFormModal({ branch, employees, onClose, onSaved, toast }) {
  const isEdit = Boolean(branch);
  const [form, setForm] = useState(
    branch
      ? {
          name: branch.name || "",
          code: branch.code || "",
          description: branch.description || "",
          address: branch.address || "",
          city: branch.city || "",
          state: branch.state || "",
          country: branch.country || "",
          phone: branch.phone || "",
          email: branch.email || "",
          managerId: branch.managerId ? String(branch.managerId) : "",
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Branch name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        managerId: form.managerId ? Number(form.managerId) : null,
      };

      if (isEdit) {
        const { data } = await updateBranch(branch.id, payload);
        onSaved(data, true);
        toast(`${data.name} updated.`, "success");
      } else {
        const { data } = await createBranch(payload);
        onSaved(data, false);
        toast(`${data.name} created.`, "success");
      }
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Something went wrong. Please try again.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{isEdit ? "Edit branch" : "Add branch"}</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Branch name *</label>
              <input
                type="text"
                placeholder="e.g. Lekki Branch"
                value={form.name}
                onChange={setField("name")}
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label>
                Code <span className={styles.optional}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. LEK"
                value={form.code}
                onChange={setField("code")}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              placeholder="What this branch handles, notes, etc."
              value={form.description}
              onChange={setField("description")}
            />
          </div>

          <div className={styles.sectionLabel}>Location</div>

          <div className={styles.field}>
            <label>Address</label>
            <input
              type="text"
              placeholder="Street address"
              value={form.address}
              onChange={setField("address")}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>City</label>
              <input
                type="text"
                value={form.city}
                onChange={setField("city")}
              />
            </div>
            <div className={styles.field}>
              <label>State</label>
              <input
                type="text"
                value={form.state}
                onChange={setField("state")}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Country</label>
            <input
              type="text"
              value={form.country}
              onChange={setField("country")}
            />
          </div>

          <div className={styles.sectionLabel}>Contact</div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={setField("phone")}
              />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={setField("email")}
              />
            </div>
          </div>

          <div className={styles.sectionLabel}>Management</div>

          <div className={styles.field}>
            <label>
              Branch manager <span className={styles.optional}>(optional)</span>
            </label>
            <select value={form.managerId} onChange={setField("managerId")}>
              <option value="">No manager assigned</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {fullName(emp)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={handleSubmit}
            disabled={saving}
            type="button"
          >
            {saving && <span className={styles.btnSpinner} />}
            {saving
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create branch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm modal ─────────────────────────────────────────────────

function DeleteBranchModal({ branch, onClose, onDeleted, toast }) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBranch(branch.id);
      onDeleted(branch.id);
      toast(`${branch.name} deleted.`, "success");
      onClose();
    } catch {
      toast("Failed to delete branch. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalSmall}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>Delete branch</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)" }}>
            Are you sure you want to delete <strong>{branch.name}</strong>?
          </p>
          {branch.employeeCount > 0 && (
            <div className={styles.warnBox}>
              <span>⚠</span>
              <span>
                {branch.employeeCount} employee
                {branch.employeeCount === 1 ? "" : "s"} currently assigned to
                this branch will be unassigned (set to Unassigned), not removed
                from the business.
              </span>
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.dangerBtn}
            onClick={handleDelete}
            disabled={deleting}
            type="button"
          >
            {deleting && <span className={styles.btnSpinner} />}
            {deleting ? "Deleting…" : "Delete branch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Branch card ───────────────────────────────────────────────────────────

function BranchCard({ branch, pulsing, onEdit, onDelete, onToggleStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  const active = branch.status === "ACTIVE";
  const location = locationLine(branch);

  return (
    <div className={`${styles.card} ${pulsing ? styles.cardPulse : ""}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardName}>{branch.name}</h3>
          {branch.code && (
            <span className={styles.codeBadge}>{branch.code}</span>
          )}
        </div>
        <div className={styles.cardMenuWrap} ref={ref}>
          <button
            className={styles.menuBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Branch actions"
            type="button"
          >
            <i className="ti ti-dots-vertical" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button
                className={styles.menuItem}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(branch);
                }}
              >
                <i className="ti ti-pencil" aria-hidden="true" /> Edit branch
              </button>
              <button
                className={styles.menuItem}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleStatus(branch);
                }}
              >
                <i
                  className={
                    active ? "ti ti-toggle-left" : "ti ti-toggle-right"
                  }
                  aria-hidden="true"
                />
                {active ? "Deactivate" : "Activate"}
              </button>
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(branch);
                }}
              >
                <i className="ti ti-trash" aria-hidden="true" /> Delete branch
              </button>
            </div>
          )}
        </div>
      </div>

      <span
        className={`${styles.statusBadge} ${active ? styles.statusActive : styles.statusInactive}`}
        style={{ alignSelf: "flex-start" }}
      >
        {active ? "Active" : "Inactive"}
      </span>

      <div className={styles.cardMeta}>
        {location && (
          <div className={styles.cardMetaRow}>
            <i className="ti ti-map-pin" aria-hidden="true" />
            <span>{location}</span>
          </div>
        )}
        {branch.phone && (
          <div className={styles.cardMetaRow}>
            <i className="ti ti-phone" aria-hidden="true" />
            <span>{branch.phone}</span>
          </div>
        )}
        {branch.email && (
          <div className={styles.cardMetaRow}>
            <i className="ti ti-mail" aria-hidden="true" />
            <span>{branch.email}</span>
          </div>
        )}
        {branch.description && (
          <div className={styles.cardMetaRow}>
            <i className="ti ti-notes" aria-hidden="true" />
            <span>{branch.description}</span>
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        {branch.managerId ? (
          <span className={styles.managerChip}>
            <span className={styles.managerAvatar}>
              {branch.managerName
                ? branch.managerName
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "?"}
            </span>
            {branch.managerName}
          </span>
        ) : (
          <span className={`${styles.managerChip} ${styles.noManager}`}>
            No manager assigned
          </span>
        )}
        <span className={styles.employeeCountPill}>
          <i className="ti ti-users" aria-hidden="true" />
          {branch.employeeCount}
        </span>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────

export default function BranchesTab() {
  const { toasts, push: toast } = useToast();

  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pulseId, setPulseId] = useState(null);

  const [formModal, setFormModal] = useState(null); // { branch: null|obj }
  const [deleteModal, setDeleteModal] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [branchRes, dirRes] = await Promise.all([
        getBranches(),
        API.get("/employees/directory"),
      ]);
      setBranches(branchRes.data);
      setEmployees(dirRes.data.filter((e) => !e.deletedAt));
    } catch (err) {
      console.error("BranchesTab: failed to fetch:", err);
      toast("Failed to load branches. Check your connection.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const pulse = (id) => {
    setPulseId(id);
    setTimeout(() => setPulseId(null), 2000);
  };

  const handleSaved = (branch, isEdit) => {
    setBranches((prev) =>
      isEdit
        ? prev.map((b) => (b.id === branch.id ? branch : b))
        : [...prev, branch],
    );
    pulse(branch.id);
  };

  const handleDeleted = (id) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  const handleToggleStatus = async (branch) => {
    const nextStatus = branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const { data } = await updateBranchStatus(branch.id, nextStatus);
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? data : b)));
      pulse(branch.id);
      toast(
        `${branch.name} ${nextStatus === "ACTIVE" ? "activated" : "deactivated"}.`,
        "success",
      );
    } catch {
      toast("Failed to update branch status. Please try again.", "error");
    }
  };

  const term = search.toLowerCase();
  const filtered = branches.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (!term) return true;
    return (
      b.name.toLowerCase().includes(term) ||
      (b.code || "").toLowerCase().includes(term) ||
      locationLine(b).toLowerCase().includes(term) ||
      (b.managerName || "").toLowerCase().includes(term)
    );
  });

  const activeCount = branches.filter((b) => b.status === "ACTIVE").length;
  const totalEmployeesAssigned = branches.reduce(
    (sum, b) => sum + (b.employeeCount || 0),
    0,
  );

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading branches…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Toast toasts={toasts} />

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Branches</h2>
          <div className={styles.headerMeta}>
            <span className={styles.metaPill}>
              <i className="ti ti-building-store" aria-hidden="true" />
              {branches.length} branch{branches.length === 1 ? "" : "es"}
            </span>
            <span className={styles.metaPill}>
              <i className="ti ti-circle-check" aria-hidden="true" />
              {activeCount} active
            </span>
            <span className={styles.metaPill}>
              <i className="ti ti-users" aria-hidden="true" />
              {totalEmployeesAssigned} employee
              {totalEmployeesAssigned === 1 ? "" : "s"} assigned
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchWrap}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search branches…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            className={styles.addBtn}
            type="button"
            onClick={() => setFormModal({ branch: null })}
          >
            <i className="ti ti-plus" aria-hidden="true" /> Add branch
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="ti ti-building-store" aria-hidden="true" />
          <h3>
            {branches.length === 0
              ? "No branches yet"
              : "No branches match your search"}
          </h3>
          <p>
            {branches.length === 0
              ? "Add your first branch to start organizing employees, attendance, and reports by location."
              : "Try a different search term or clear the status filter."}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              pulsing={pulseId === b.id}
              onEdit={(branch) => setFormModal({ branch })}
              onDelete={(branch) => setDeleteModal(branch)}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {formModal && (
        <BranchFormModal
          branch={formModal.branch}
          employees={employees}
          onClose={() => setFormModal(null)}
          onSaved={handleSaved}
          toast={toast}
        />
      )}

      {deleteModal && (
        <DeleteBranchModal
          branch={deleteModal}
          onClose={() => setDeleteModal(null)}
          onDeleted={handleDeleted}
          toast={toast}
        />
      )}
    </div>
  );
}
