import { useState, useEffect, useCallback, useRef } from "react";
import API from "../api/authApi";
import {
  getBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
  deleteBranch,
} from "../api/branchApi";
import CustomSelect from "./CustomSelect";
import BranchDetail from "./BranchDetail";
import styles from "./BranchesTab.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(" ") || "—";
}

function empInitials(emp) {
  return `${emp?.firstName?.[0] || ""}${emp?.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function nameInitials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
}

function locationLine(b) {
  return [b.address, b.city, b.state, b.country].filter(Boolean).join(", ");
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses", icon: "ti-list" },
  { value: "ACTIVE", label: "Active", icon: "ti-circle-check" },
  { value: "INACTIVE", label: "Inactive", icon: "ti-circle-minus" },
];

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className={styles.toastStack}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]}`}>
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
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

// ── Add / Edit Branch — full in-flow page, not a modal ───────────────────

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

function BranchFormPage({ branch, employees, onCancel, onSaved, toast }) {
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
  const topRef = useRef(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const managerOptions = [
    { value: "", label: "No manager assigned", icon: "ti-user-off" },
    ...(employees || []).map((emp) => ({
      value: String(emp.id),
      label: fullName(emp),
      emp,
    })),
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Branch name is required.");
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
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
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Something went wrong. Please try again.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.pageWrap}>
      <div ref={topRef} />

      <div className={styles.pageHeader}>
        <button type="button" className={styles.backBtn} onClick={onCancel}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Back to branches
        </button>

        <div className={styles.pageHeaderRow}>
          <div>
            <h2 className={styles.pageTitle}>
              {isEdit ? "Edit branch" : "Add a new branch"}
            </h2>
            <p className={styles.pageSubtitle}>
              {isEdit
                ? `Update details for ${branch.name}.`
                : "Set up a new location for your business — you can always edit this later."}
            </p>
          </div>

          <div className={styles.pageHeaderActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleSubmit}
              disabled={saving}
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

      {error && (
        <div className={styles.errorBox}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <section className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <i className="ti ti-building-store" aria-hidden="true" />
            <div>
              <h3>Basic information</h3>
              <p>What this branch is called and what it does.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
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
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>
                Description <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                placeholder="What this branch handles, notes, etc."
                value={form.description}
                onChange={setField("description")}
              />
            </div>
          </div>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <i className="ti ti-map-pin" aria-hidden="true" />
            <div>
              <h3>Location</h3>
              <p>Where this branch is physically located.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>Address</label>
              <input
                type="text"
                placeholder="Street address"
                value={form.address}
                onChange={setField("address")}
              />
            </div>
            <div className={styles.field}>
              <label>City</label>
              <input type="text" value={form.city} onChange={setField("city")} />
            </div>
            <div className={styles.field}>
              <label>State</label>
              <input type="text" value={form.state} onChange={setField("state")} />
            </div>
            <div className={styles.field}>
              <label>Country</label>
              <input type="text" value={form.country} onChange={setField("country")} />
            </div>
          </div>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <i className="ti ti-phone" aria-hidden="true" />
            <div>
              <h3>Contact</h3>
              <p>How employees and customers can reach this branch.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={setField("phone")} />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={setField("email")} />
            </div>
          </div>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <i className="ti ti-user-star" aria-hidden="true" />
            <div>
              <h3>Branch manager</h3>
              <p>Give one employee scoped oversight of this branch.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>
                Manager <span className={styles.optional}>(optional)</span>
              </label>
              <CustomSelect
                value={form.managerId}
                onChange={(v) => setForm((f) => ({ ...f, managerId: v || "" }))}
                options={managerOptions}
                placeholder="No manager assigned"
                searchable
                searchPlaceholder="Search employees…"
                emptyLabel="No employees found"
                renderOption={(opt, isSelected) => (
                  <>
                    {opt.emp ? (
                      <span className={styles.optionAvatar}>{empInitials(opt.emp)}</span>
                    ) : (
                      <i className="ti ti-user-off" aria-hidden="true" />
                    )}
                    <span>{opt.label}</span>
                    {isSelected && <i className="ti ti-check" aria-hidden="true" />}
                  </>
                )}
              />
            </div>
          </div>
        </section>
      </form>

      <div className={styles.pageFooterActions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={saving}
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
  );
}

// ── Delete confirmation — a purpose-built dialog, not a native confirm() ──

function DeleteBranchDialog({ branch, onClose, onDeleted, toast }) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && !deleting && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, deleting]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBranch(branch.id);
      onDeleted(branch.id);
      toast(`${branch.name} deleted.`, "success");
      onClose();
    } catch {
      toast("Failed to delete branch. Please try again.", "error");
      setDeleting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !deleting && onClose()}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className={styles.dialogIconWrap}>
          <i className="ti ti-trash" aria-hidden="true" />
        </div>
        <h3 className={styles.dialogTitle}>Delete {branch.name}?</h3>
        <p className={styles.dialogBody}>
          This can't be undone. The branch and its details will be permanently removed.
        </p>
        {branch.employeeCount > 0 && (
          <div className={styles.warnBox}>
            <i className="ti ti-alert-triangle" aria-hidden="true" />
            <span>
              {branch.employeeCount} employee{branch.employeeCount === 1 ? "" : "s"}{" "}
              currently assigned here will be unassigned, not removed from the business.
            </span>
          </div>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={handleDelete}
            disabled={deleting}
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

function BranchCard({ branch, pulsing, onOpen, onEdit, onDelete, onToggleStatus }) {
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
    <div
      className={`${styles.card} ${pulsing ? styles.cardPulse : ""}`}
      onClick={() => onOpen(branch)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(branch);
      }}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardIcon}>
            <i className="ti ti-building-store" aria-hidden="true" />
          </span>
          <div className={styles.cardTitleText}>
            <h3 className={styles.cardName}>{branch.name}</h3>
            {branch.code && <span className={styles.codeBadge}>{branch.code}</span>}
          </div>
        </div>
        <div className={styles.cardMenuWrap} ref={ref} onClick={(e) => e.stopPropagation()}>
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
                  onOpen(branch);
                }}
              >
                <i className="ti ti-layout-dashboard" aria-hidden="true" /> View dashboard
              </button>
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
                  className={active ? "ti ti-toggle-left" : "ti ti-toggle-right"}
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
      >
        <span className={styles.statusDot} />
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
            <span className={styles.managerAvatar}>{nameInitials(branch.managerName)}</span>
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

  const [view, setView] = useState({ mode: "list" }); // { mode: "list" } | { mode: "add" } | { mode: "edit", branch } | { mode: "detail", branch }

  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pulseId, setPulseId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
      isEdit ? prev.map((b) => (b.id === branch.id ? branch : b)) : [...prev, branch],
    );
    pulse(branch.id);
    // If we got here from a branch's detail page, land back on that
    // (now-updated) detail view instead of the list, so editing a branch
    // doesn't kick the user out of the dashboard they were just looking at.
    if (view.mode === "edit" && view.cameFromDetail) {
      setView({ mode: "detail", branch });
    } else {
      setView({ mode: "list" });
    }
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

  // ── Page mode: Add / Edit ────────────────────────────────────────────
  if (view.mode === "add" || view.mode === "edit") {
    return (
      <div className={styles.wrap}>
        <Toast toasts={toasts} />
        <BranchFormPage
          branch={view.mode === "edit" ? view.branch : null}
          employees={employees}
          onCancel={() =>
            setView(
              view.mode === "edit" && view.cameFromDetail
                ? { mode: "detail", branch: view.branch }
                : { mode: "list" },
            )
          }
          onSaved={handleSaved}
          toast={toast}
        />
      </div>
    );
  }

  // ── Page mode: Branch detail (dashboard) ─────────────────────────────
  if (view.mode === "detail") {
    return (
      <div className={styles.wrap}>
        <Toast toasts={toasts} />
        <BranchDetail
          branch={view.branch}
          onBack={() => setView({ mode: "list" })}
          onEdit={(branch) => setView({ mode: "edit", branch, cameFromDetail: true })}
        />
      </div>
    );
  }

  // ── List mode ─────────────────────────────────────────────────────────
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
  const totalEmployeesAssigned = branches.reduce((sum, b) => sum + (b.employeeCount || 0), 0);

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
          <p className={styles.titleSub}>
            Manage your business's locations and who runs them.
          </p>
        </div>
        <button
          className={styles.addBtn}
          type="button"
          onClick={() => setView({ mode: "add" })}
        >
          <i className="ti ti-plus" aria-hidden="true" /> Add branch
        </button>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <i className="ti ti-building-store" aria-hidden="true" />
          </span>
          <div>
            <div className={styles.statValue}>{branches.length}</div>
            <div className={styles.statLabel}>Total branches</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconActive}`}>
            <i className="ti ti-circle-check" aria-hidden="true" />
          </span>
          <div>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconUsers}`}>
            <i className="ti ti-users" aria-hidden="true" />
          </span>
          <div>
            <div className={styles.statValue}>{totalEmployeesAssigned}</div>
            <div className={styles.statLabel}>Employees assigned</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search branches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.statusFilterWrap}>
          <CustomSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || "")}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            align="right"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="ti ti-building-store" aria-hidden="true" />
          <h3>{branches.length === 0 ? "No branches yet" : "No branches match your search"}</h3>
          <p>
            {branches.length === 0
              ? "Add your first branch to start organizing employees, attendance, and reports by location."
              : "Try a different search term or clear the status filter."}
          </p>
          {branches.length === 0 && (
            <button
              className={styles.addBtn}
              type="button"
              onClick={() => setView({ mode: "add" })}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Add branch
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              pulsing={pulseId === b.id}
              onOpen={(branch) => setView({ mode: "detail", branch })}
              onEdit={(branch) => setView({ mode: "edit", branch })}
              onDelete={(branch) => setDeleteTarget(branch)}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteBranchDialog
          branch={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
          toast={toast}
        />
      )}
    </div>
  );
}