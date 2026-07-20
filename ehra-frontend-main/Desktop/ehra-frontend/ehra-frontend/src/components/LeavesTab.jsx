import { useState, useEffect, useCallback, useRef } from "react";
import {
  getBusinessLeaves,
  approveLeave,
  rejectLeave,
  getLeavePolicies,
  updateLeavePolicy,
  getBusinessBalances,
  getCurrentlyOnLeaveForBusiness,
} from "../api/leaveApi";
import useMessageStream from "../hooks/useMessageStream";
import {
  leaveTypeLabel,
  leaveStatusConfig,
  leaveStageDescription,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPE_ICON,
  formatDate,
  timeAgo,
  initials,
} from "../utils/leaveHelpers";
import styles from "./LeavesTab.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Which statuses appear in each employer sub-tab
const TAB_STATUSES = {
  PENDING: ["PENDING_EMPLOYER"],
  IN_CHAIN: ["PENDING_COVER", "COVER_DECLINED", "PENDING_HOD"],
  APPROVED: ["APPROVED"],
  REJECTED: ["REJECTED", "CANCELLED"],
};

// Drives the thin scroll-position indicator under the employer nav on
// mobile, once it's a horizontally-scrollable pill strip — same
// scroll-linked-cue pattern already used for the app's other scrollable
// tab strips (dashboard bottom nav, quick actions).
function useScrollThumb(ref) {
  const [thumb, setThumb] = useState({ left: 0, width: 100 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setThumb({ left: 0, width: 100 });
        return;
      }
      const width = Math.max((clientWidth / scrollWidth) * 100, 15);
      const maxScroll = scrollWidth - clientWidth;
      const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - width) : 0;
      setThumb({ left, width });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return thumb;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowTimeline({ leave }) {
  const steps = [];

  // Step 1 — Cover (if there was one)
  if (leave.coverPersonFirstName) {
    steps.push({
      label: "Cover person",
      detail:
        `${leave.coverPersonFirstName} ${leave.coverPersonLastName || ""}`.trim(),
      state:
        leave.coverAccepted === true
          ? "done"
          : leave.coverAccepted === false
            ? "rejected"
            : "pending",
      note: leave.coverNote,
    });
  }

  // Step 2 — HOD (if there was one)
  if (leave.hodDecidedByName) {
    steps.push({
      label: "Head of Dept",
      detail: leave.hodDecidedByName,
      state:
        leave.hodApproved === true
          ? "done"
          : leave.hodApproved === false
            ? "rejected"
            : "pending",
      note: leave.hodNote,
    });
  }

  // Step 3 — Employer (always last)
  steps.push({
    label: "Employer",
    detail: "Final sign-off",
    state:
      leave.status === "APPROVED"
        ? "done"
        : leave.status === "REJECTED"
          ? "rejected"
          : "pending",
    note: leave.adminNote,
  });

  if (steps.length <= 1) return null; // nothing interesting to show

  return (
    <div className={styles.timeline}>
      {steps.map((s, i) => (
        <div key={i} className={styles.timelineStep}>
          <div
            className={`${styles.timelineDot} ${
              s.state === "done"
                ? styles.timelineDotDone
                : s.state === "rejected"
                  ? styles.timelineDotRejected
                  : styles.timelineDotPending
            }`}
          >
            <i
              className={`ti ${
                s.state === "done"
                  ? "ti-check"
                  : s.state === "rejected"
                    ? "ti-x"
                    : "ti-clock"
              }`}
            />
          </div>
          {i < steps.length - 1 && (
            <div
              className={`${styles.timelineLine} ${
                s.state === "done" ? styles.timelineLineDone : ""
              }`}
            />
          )}
          <div className={styles.timelineContent}>
            <span className={styles.timelineLabel}>{s.label}</span>
            <span className={styles.timelineDetail}>{s.detail}</span>
            {s.note && <span className={styles.timelineNote}>"{s.note}"</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Policy editor ────────────────────────────────────────────────────────────

function PolicyEditor() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // leaveType being saved
  const [edits, setEdits] = useState({}); // { policyId: { field: value } }
  const [saved, setSaved] = useState({}); // { policyId: true } — green flash

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getLeavePolicies();
      setPolicies(data);
      // Seed edits from server state
      const init = {};
      data.forEach((p) => {
        init[p.id] = {
          active: p.active,
          maxDaysPerYear: p.maxDaysPerYear,
          requiresCover: p.requiresCover,
          requiresHod: p.requiresHod,
          minNoticeDays: p.minNoticeDays ?? 0,
          maxDaysPerRequest: p.maxDaysPerRequest ?? 0,
        };
      });
      setEdits(init);
    } catch (err) {
      console.error("Failed to load policies:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const setEdit = (id, field, value) =>
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));

  const handleSave = async (policy) => {
    const e = edits[policy.id];
    if (!e) return;
    setSaving(policy.id);
    try {
      await updateLeavePolicy(policy.id, {
        active: e.active,
        maxDaysPerYear: Number(e.maxDaysPerYear),
        requiresCover: e.requiresCover,
        requiresHod: e.requiresHod,
        minNoticeDays: Number(e.minNoticeDays ?? 0),
        maxDaysPerRequest: Number(e.maxDaysPerRequest ?? 0),
      });
      setSaved((prev) => ({ ...prev, [policy.id]: true }));
      setTimeout(
        () => setSaved((prev) => ({ ...prev, [policy.id]: false })),
        2000,
      );
      await fetchPolicies();
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "Failed to save policy. Please try again.",
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <p className={styles.empty}>Loading leave policies…</p>;

  return (
    <div className={styles.policyList}>
      <div className={styles.policyNote}>
        <i className="ti ti-info-circle" />
        Changes apply immediately. Employees see only active leave types when
        requesting leave. Balance deductions happen automatically when a leave
        is approved.
      </div>

      {policies.map((policy) => {
        const e = edits[policy.id] || {};
        const icon = LEAVE_TYPE_ICON[policy.leaveType] || "ti-calendar";
        const isSaving = saving === policy.id;
        const wasSaved = saved[policy.id];
        const isDirty =
          e.active !== policy.active ||
          Number(e.maxDaysPerYear) !== policy.maxDaysPerYear ||
          e.requiresCover !== policy.requiresCover ||
          e.requiresHod !== policy.requiresHod ||
          Number(e.minNoticeDays ?? 0) !== (policy.minNoticeDays ?? 0) ||
          Number(e.maxDaysPerRequest ?? 0) !== (policy.maxDaysPerRequest ?? 0);

        return (
          <div
            key={policy.id}
            className={`${styles.policyRow} ${!e.active ? styles.policyRowInactive : ""}`}
          >
            {/* Type header */}
            <div className={styles.policyTypeHeader}>
              <i
                className={`ti ${icon}`}
                style={{
                  color: e.active ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 20,
                }}
              />
              <div>
                <div className={styles.policyTypeName}>
                  {leaveTypeLabel(policy.leaveType)}
                </div>
                <div className={styles.policyTypeKey}>{policy.leaveType}</div>
              </div>

              {/* Active toggle */}
              <label
                className={styles.toggleLabel}
                title={e.active ? "Enabled" : "Disabled"}
              >
                <input
                  type="checkbox"
                  checked={e.active || false}
                  onChange={(ev) =>
                    setEdit(policy.id, "active", ev.target.checked)
                  }
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider} />
                <span className={styles.toggleText}>
                  {e.active ? "Active" : "Inactive"}
                </span>
              </label>
            </div>

            {e.active && (
              <div className={styles.policyFields}>
                {/* Max days */}
                <div className={styles.policyField}>
                  <label>
                    Max days / year
                    <span className={styles.policyFieldHint}>
                      (0 = unlimited)
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={e.maxDaysPerYear ?? 0}
                    onChange={(ev) =>
                      setEdit(policy.id, "maxDaysPerYear", ev.target.value)
                    }
                    className={styles.policyInput}
                  />
                </div>

                {/* Requires cover */}
                <div className={styles.policyCheckField}>
                  <label>
                    <input
                      type="checkbox"
                      checked={e.requiresCover || false}
                      onChange={(ev) =>
                        setEdit(policy.id, "requiresCover", ev.target.checked)
                      }
                    />
                    <span>Requires a cover person</span>
                    <span className={styles.policyFieldHint}>
                      — employee must nominate a colleague before submitting
                    </span>
                  </label>
                </div>

                {/* Requires HOD */}
                <div className={styles.policyCheckField}>
                  <label>
                    <input
                      type="checkbox"
                      checked={e.requiresHod || false}
                      onChange={(ev) =>
                        setEdit(policy.id, "requiresHod", ev.target.checked)
                      }
                    />
                    <span>Requires HOD approval</span>
                    <span className={styles.policyFieldHint}>
                      — skipped if the employee's department has no HOD
                    </span>
                  </label>
                </div>

                {/* Minimum notice days */}
                <div className={styles.policyField}>
                  <label>
                    Minimum notice days
                    <span className={styles.policyFieldHint}>
                      (0 = same-day allowed, e.g. for Sick / Emergency)
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={e.minNoticeDays ?? 0}
                    onChange={(ev) =>
                      setEdit(policy.id, "minNoticeDays", ev.target.value)
                    }
                    className={styles.policyInput}
                  />
                </div>

                {/* Max days per single request */}
                <div className={styles.policyField}>
                  <label>
                    Max days per single request
                    <span className={styles.policyFieldHint}>
                      (0 = no per-request cap)
                    </span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={e.maxDaysPerRequest ?? 0}
                    onChange={(ev) =>
                      setEdit(policy.id, "maxDaysPerRequest", ev.target.value)
                    }
                    className={styles.policyInput}
                  />
                </div>
              </div>
            )}

            {/* Save button */}
            {isDirty && (
              <div className={styles.policySaveRow}>
                <button
                  className={styles.policySaveBtn}
                  disabled={isSaving}
                  onClick={() => handleSave(policy)}
                >
                  <i className="ti ti-device-floppy" />
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
            {wasSaved && !isDirty && (
              <div className={styles.policySavedMsg}>
                <i className="ti ti-circle-check" /> Saved
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── On Leave panel (employer) ────────────────────────────────────────────────

function OnLeavePanel() {
  const [onLeave, setOnLeave] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getCurrentlyOnLeaveForBusiness();
      setOnLeave(data);
    } catch (err) {
      console.error("Failed to load on-leave employees:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Live update — patch the "currently on leave" list in-place
  useMessageStream({
    onLeaveUpdate: (leave) => {
      if (leave.status === "APPROVED") {
        setOnLeave((prev) => {
          const exists = prev.some((l) => l.id === leave.id);
          if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
          return [leave, ...prev];
        });
      } else {
        // No longer approved — remove from the on-leave view
        setOnLeave((prev) => prev.filter((l) => l.id !== leave.id));
      }
    },
  });

  if (loading) {
    return (
      <div className={styles.onLeaveEmpty}>
        <i
          className="ti ti-loader-2"
          style={{ fontSize: 28, color: "var(--text-secondary)" }}
        />
        <p>Loading…</p>
      </div>
    );
  }

  if (onLeave.length === 0) {
    return (
      <div className={styles.onLeaveEmpty}>
        <i
          className="ti ti-building-community"
          style={{ fontSize: 36, color: "var(--text-secondary)" }}
        />
        <p className={styles.onLeaveEmptyTitle}>Everyone is in</p>
        <p className={styles.onLeaveEmptySub}>
          No employees are currently on approved leave.
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className={styles.onLeaveGrid}>
      {onLeave.map((l) => {
        const icon = LEAVE_TYPE_ICON[l.leaveType] || "ti-calendar";
        const label = LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType;
        const end = new Date(l.endDate);
        end.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((end - today) / 86400000) + 1;

        return (
          <div key={l.id} className={styles.onLeaveCard}>
            {/* Avatar + name */}
            <div className={styles.onLeaveCardTop}>
              <div className={styles.onLeaveAvatar}>
                {l.employeeProfilePictureUrl ? (
                  <img src={l.employeeProfilePictureUrl} alt="" />
                ) : (
                  initials(l.employeeFirstName, l.employeeLastName)
                )}
              </div>
              <div className={styles.onLeaveCardInfo}>
                <span className={styles.onLeaveCardName}>
                  {l.employeeFirstName} {l.employeeLastName}
                </span>
                <span className={styles.onLeaveCardDept}>{l.department}</span>
              </div>
              {/* Days-left pill */}
              <span
                className={styles.daysLeftPill}
                style={{
                  background:
                    daysLeft <= 1
                      ? "#fdeceb"
                      : daysLeft <= 3
                        ? "#faeeda"
                        : "#e8f5f0",
                  color:
                    daysLeft <= 1
                      ? "#c0392b"
                      : daysLeft <= 3
                        ? "#633806"
                        : "var(--accent)",
                }}
              >
                {daysLeft === 1 ? "Back tomorrow" : `${daysLeft}d left`}
              </span>
            </div>

            {/* Leave type */}
            <div className={styles.onLeaveTypePill}>
              <i className={`ti ${icon}`} />
              {label}
            </div>

            {/* Dates */}
            <div className={styles.onLeaveDateRow}>
              <i className="ti ti-calendar" />
              <span>{formatDate(l.startDate)}</span>
              <i className="ti ti-arrow-right" style={{ fontSize: 11 }} />
              <span>{formatDate(l.endDate)}</span>
              <span className={styles.onLeaveDaysBadge}>{l.days}d total</span>
            </div>

            {/* Cover person */}
            {l.coverPersonFirstName && (
              <div className={styles.onLeaveCoverRow}>
                <i
                  className="ti ti-user-check"
                  style={{ color: "var(--accent)" }}
                />
                <span>
                  Covered by{" "}
                  <strong>
                    {l.coverPersonFirstName} {l.coverPersonLastName}
                  </strong>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Balances overview panel ──────────────────────────────────────────────────

function BalancesPanel() {
  const year = new Date().getFullYear();
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Card list (mobile) starts fully collapsed — a business with any real
  // headcount turns into a long scroll of chip grids otherwise. Nothing
  // in this Set means nothing's expanded.
  const [expandedCards, setExpandedCards] = useState(new Set());
  const toggleCard = (key) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    getBusinessBalances(year)
      .then(({ data }) => setBalances(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <p className={styles.empty}>Loading balances…</p>;
  if (balances.length === 0)
    return (
      <p className={styles.empty}>
        No employees with leave balances yet for {year}.
      </p>
    );

  // Group by employee
  const byEmployee = {};
  balances.forEach((b) => {
    const key = b.employeeEmail || b.employeeId;
    if (!byEmployee[key]) {
      byEmployee[key] = {
        name: [b.employeeFirstName, b.employeeLastName]
          .filter(Boolean)
          .join(" "),
        email: b.employeeEmail,
        profilePictureUrl: b.employeeProfilePictureUrl,
        balances: [],
      };
    }
    byEmployee[key].balances.push(b);
  });

  const balanceTone = (daysRemaining) =>
    daysRemaining <= 0
      ? "#dc2626"
      : daysRemaining <= 2
        ? "#d97706"
        : "var(--accent)";

  return (
    <>
      {/* Table — horizontally-scrollable, sticky first column. Fine down to
          tablet width, but a spreadsheet you have to pan around stops being
          usable on a phone, so it's hidden below that breakpoint in favor
          of the card list underneath (see .balancesTable / .balancesCards
          in the stylesheet). */}
      <div className={styles.balancesTable}>
        <table className={styles.empTable}>
          <thead>
            <tr>
              <th>Employee</th>
              {Object.values(LEAVE_TYPE_LABEL).map((label) => (
                <th key={label} style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(byEmployee).map((emp) => (
              <tr key={emp.email}>
                <td>
                  <div className={styles.empNameCell}>
                    <div className={styles.empAv}>
                      {emp.profilePictureUrl ? (
                        <img src={emp.profilePictureUrl} alt="" />
                      ) : (
                        initials(
                          emp.name?.split(" ")[0],
                          emp.name?.split(" ")[1],
                        )
                      )}
                    </div>
                    <div>
                      <div className={styles.empName}>{emp.name}</div>
                      <div className={styles.empEmail}>{emp.email}</div>
                    </div>
                  </div>
                </td>
                {Object.keys(LEAVE_TYPE_LABEL).map((type) => {
                  const b = emp.balances.find((x) => x.leaveType === type);
                  if (!b)
                    return (
                      <td key={type} className={styles.muted}>
                        —
                      </td>
                    );
                  const pct =
                    b.maxDaysPerYear > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (b.daysRemaining / b.maxDaysPerYear) * 100,
                          ),
                        )
                      : 100;
                  return (
                    <td key={type}>
                      <div className={styles.balanceCellWrap}>
                        <span
                          className={styles.balanceCellVal}
                          style={{ color: balanceTone(b.daysRemaining) }}
                        >
                          {b.daysRemaining < 0 ? "∞" : b.daysRemaining}
                        </span>
                        {b.maxDaysPerYear > 0 && (
                          <div className={styles.miniBar}>
                            <div
                              className={styles.miniBarFill}
                              style={{
                                width: `${pct}%`,
                                background: balanceTone(b.daysRemaining),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card list — phone-only (see .balancesCards). Each employee's
          balances become a wrapped row of small labeled chips instead of
          a table cell, so nothing needs a sideways scroll to be read.
          Collapsed by default — a card per employee times a chip per
          leave type gets long fast on a real headcount, so only the
          summary shows until you tap to open one. */}
      <div className={styles.balancesCards}>
        {Object.values(byEmployee).map((emp) => {
          const isOpen = expandedCards.has(emp.email);
          const totalRemaining = emp.balances.reduce(
            (sum, b) => sum + (b.daysRemaining >= 0 ? b.daysRemaining : 0),
            0,
          );
          const hasUnlimited = emp.balances.some((b) => b.daysRemaining < 0);

          return (
            <div className={styles.balanceCard} key={emp.email}>
              <button
                type="button"
                className={styles.balanceCardHeader}
                onClick={() => toggleCard(emp.email)}
                aria-expanded={isOpen}
              >
                <div className={styles.empNameCell}>
                  <div className={styles.empAv}>
                    {emp.profilePictureUrl ? (
                      <img src={emp.profilePictureUrl} alt="" />
                    ) : (
                      initials(emp.name?.split(" ")[0], emp.name?.split(" ")[1])
                    )}
                  </div>
                  <div>
                    <div className={styles.empName}>{emp.name}</div>
                    <div className={styles.empEmail}>{emp.email}</div>
                  </div>
                </div>
                <div className={styles.balanceCardSummary}>
                  <span className={styles.balanceCardTotal}>
                    {totalRemaining}
                    {hasUnlimited ? "+" : ""} day
                    {totalRemaining === 1 && !hasUnlimited ? "" : "s"} left
                  </span>
                  <i
                    className={`ti ti-chevron-down ${styles.balanceCardChevron} ${isOpen ? styles.balanceCardChevronOpen : ""}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className={styles.balanceChipGrid}>
                  {Object.keys(LEAVE_TYPE_LABEL).map((type) => {
                    const b = emp.balances.find((x) => x.leaveType === type);
                    if (!b) return null;
                    const pct =
                      b.maxDaysPerYear > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (b.daysRemaining / b.maxDaysPerYear) * 100,
                            ),
                          )
                        : 100;
                    return (
                      <div className={styles.balanceChip} key={type}>
                        <div className={styles.balanceChipTop}>
                          <span className={styles.balanceChipLabel}>
                            {LEAVE_TYPE_LABEL[type]}
                          </span>
                          <span
                            className={styles.balanceChipVal}
                            style={{ color: balanceTone(b.daysRemaining) }}
                          >
                            {b.daysRemaining < 0 ? "∞" : b.daysRemaining}
                          </span>
                        </div>
                        {b.maxDaysPerYear > 0 && (
                          <div className={styles.miniBar}>
                            <div
                              className={styles.miniBarFill}
                              style={{
                                width: `${pct}%`,
                                background: balanceTone(b.daysRemaining),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "PENDING", label: "Awaiting Me", icon: "ti-clock" },
  { key: "IN_CHAIN", label: "In Progress", icon: "ti-loader-2" },
  { key: "APPROVED", label: "Approved", icon: "ti-circle-check" },
  { key: "REJECTED", label: "Rejected", icon: "ti-circle-x" },
];

const EMPLOYER_SECTIONS = [
  { key: "requests", label: "Requests", icon: "ti-calendar-event" },
  { key: "on-leave", label: "On Leave", icon: "ti-walk" },
  { key: "policies", label: "Leave Policies", icon: "ti-settings" },
  { key: "balances", label: "Balances", icon: "ti-chart-bar" },
];

export default function LeavesTab() {
  const [section, setSection] = useState("requests");

  // ── On-leave count for nav badge ──────────────────────────────────────
  const [onLeaveCount, setOnLeaveCount] = useState(0);

  useEffect(() => {
    getCurrentlyOnLeaveForBusiness()
      .then(({ data }) => setOnLeaveCount(data.length))
      .catch(() => {});
  }, []);

  // ── Requests state ────────────────────────────────────────────────────
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING");
  const [selected, setSelected] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  // Drives the mobile layout: below the breakpoint the list and detail
  // panes can't sit side by side, so the detail pane becomes a full-screen
  // overlay that slides over the list instead — see .showDetail below.
  const showingDetail = Boolean(selected);

  // ── Swipe-to-go-back on the detail pane (touch only) — same
  // finger-follows-exactly technique as the Messages inbox: mutate the
  // DOM node directly via a ref rather than routing every touchmove
  // through React state, which is what keeps it from lagging behind
  // a fast swipe. ──────────────────────────────────────────────────────
  const detailPanelRef = useRef(null);
  const dragState = useRef({ startX: 0, dx: 0, active: false });

  const handleTouchStart = (e) => {
    dragState.current = { startX: e.touches[0].clientX, dx: 0, active: true };
    if (detailPanelRef.current)
      detailPanelRef.current.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.current.active || !detailPanelRef.current) return;
    const dx = e.touches[0].clientX - dragState.current.startX;
    if (dx <= 0) return; // only rightward (back) swipes move the panel
    const clamped = Math.min(dx, detailPanelRef.current.offsetWidth);
    dragState.current.dx = clamped;
    detailPanelRef.current.style.transform = `translateX(${clamped}px)`;
  };

  const handleTouchEnd = () => {
    if (!dragState.current.active || !detailPanelRef.current) return;
    dragState.current.active = false;
    detailPanelRef.current.style.transition = "";
    detailPanelRef.current.style.transform = "";
    if (dragState.current.dx > 90) setSelected(null);
  };

  // Employer nav becomes a horizontally-scrollable pill strip on mobile —
  // this drives its scroll-position indicator.
  const employerNavScrollRef = useRef(null);
  const employerNavThumb = useScrollThumb(employerNavScrollRef);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getBusinessLeaves();
      setLeaves(data);
    } catch (err) {
      console.error("Failed to load leaves:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live update — patch the leaves list in-place from the pushed LeaveDTO
  useMessageStream({
    onLeaveUpdate: (leave) => {
      setLeaves((prev) => {
        const exists = prev.some((l) => l.id === leave.id);
        if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
        return [leave, ...prev];
      });
      // Update the "currently on leave" badge count when a leave becomes
      // APPROVED or is no longer active so the nav badge stays accurate.
      if (leave.status === "APPROVED") {
        setOnLeaveCount((c) => c + 1);
      } else if (["REJECTED", "CANCELLED"].includes(leave.status)) {
        setOnLeaveCount((c) => Math.max(0, c - 1));
      }
    },
  });

  // Group by employer-view tabs
  const byTab = {};
  TABS.forEach((t) => {
    byTab[t.key] = leaves.filter((l) => TAB_STATUSES[t.key].includes(l.status));
  });

  const handleApprove = async (id) => {
    setActioning(id);
    try {
      await approveLeave(id, adminNote || null);
      await fetchAll();
      setSelected(null);
      setAdminNote("");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve leave.");
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id) => {
    setActioning(id);
    try {
      await rejectLeave(id, rejectNote || null);
      await fetchAll();
      setSelected(null);
      setRejectNote("");
      setShowRejectBox(false);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reject leave.");
    } finally {
      setActioning(null);
    }
  };

  const handleSelect = (l) => {
    setSelected(l);
    setAdminNote("");
    setRejectNote("");
    setShowRejectBox(false);
  };

  return (
    <div className={styles.container}>
      {/* ── Top-level employer nav (Requests / Policies / Balances) ── */}
      <div className={styles.employerNavWrap}>
        <div className={styles.employerNav} ref={employerNavScrollRef}>
          {EMPLOYER_SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`${styles.employerNavBtn} ${section === s.key ? styles.employerNavBtnActive : ""}`}
              onClick={() => setSection(s.key)}
            >
              <i className={`ti ${s.icon}`} />
              {s.label}
              {s.key === "requests" && byTab.PENDING.length > 0 && (
                <span className={styles.pendingCount}>
                  {byTab.PENDING.length}
                </span>
              )}
              {s.key === "on-leave" && onLeaveCount > 0 && (
                <span className={styles.onLeaveNavBadge}>{onLeaveCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.employerNavScrollTrack} aria-hidden="true">
          <div
            className={styles.employerNavScrollThumb}
            style={{
              width: `${employerNavThumb.width}%`,
              left: `${employerNavThumb.left}%`,
            }}
          />
        </div>
      </div>

      {/* ══════════ REQUESTS SECTION ══════════ */}
      {section === "requests" && (
        <div
          className={`${styles.requestsLayout} ${showingDetail ? styles.showDetail : ""}`}
        >
          {/* ── Left: list ── */}
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <h2 className={styles.listTitle}>
                <i className="ti ti-calendar-event" /> Leave Requests
              </h2>
            </div>

            {/* Status tabs */}
            <div className={styles.statusTabs}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`${styles.statusTab} ${activeTab === t.key ? styles.statusTabActive : ""}`}
                  onClick={() => {
                    setActiveTab(t.key);
                    setSelected(null);
                  }}
                >
                  {t.label}
                  <span className={styles.tabCount}>{byTab[t.key].length}</span>
                </button>
              ))}
            </div>

            <div className={styles.list}>
              {loading ? (
                <p className={styles.empty}>Loading leave requests…</p>
              ) : byTab[activeTab].length === 0 ? (
                <div className={styles.emptyState}>
                  <i
                    className="ti ti-calendar-event"
                    style={{ fontSize: 30, color: "var(--text-secondary)" }}
                  />
                  <p>No requests in this category</p>
                </div>
              ) : (
                byTab[activeTab].map((l) => {
                  const cfg = leaveStatusConfig(l.status);
                  const name = [l.employeeFirstName, l.employeeLastName]
                    .filter(Boolean)
                    .join(" ");
                  const typeIcon =
                    LEAVE_TYPE_ICON[l.leaveType] || "ti-calendar";
                  return (
                    <div
                      key={l.id}
                      className={`${styles.listItem} ${selected?.id === l.id ? styles.active : ""}`}
                      onClick={() => handleSelect(l)}
                    >
                      <div className={styles.empRow}>
                        <div className={styles.avatar}>
                          {l.employeeProfilePictureUrl ? (
                            <img src={l.employeeProfilePictureUrl} alt="" />
                          ) : (
                            initials(l.employeeFirstName, l.employeeLastName)
                          )}
                        </div>
                        <div className={styles.empInfo}>
                          <div className={styles.empName}>{name}</div>
                          <div className={styles.empDept}>
                            <i
                              className={`ti ${typeIcon}`}
                              style={{ marginRight: 4 }}
                            />
                            {leaveTypeLabel(l.leaveType)}
                          </div>
                        </div>
                        <span
                          className={styles.pill}
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className={styles.leaveRange}>
                        <i className="ti ti-calendar" />
                        {formatDate(l.startDate)} → {formatDate(l.endDate)}
                        <span className={styles.daysBadge}>{l.days}d</span>
                      </div>
                      <div className={styles.listItemTime}>
                        {timeAgo(l.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div
            className={styles.detailPanel}
            ref={detailPanelRef}
            onTouchStart={showingDetail ? handleTouchStart : undefined}
            onTouchMove={showingDetail ? handleTouchMove : undefined}
            onTouchEnd={showingDetail ? handleTouchEnd : undefined}
          >
            {selected ? (
              <div className={styles.detailArea}>
                {/* Mobile-only back affordance — the detail pane is a
                    full-screen overlay below the breakpoint, so it needs
                    its own way back besides the desktop-only X below. */}
                <button
                  type="button"
                  className={styles.mobileBackBtn}
                  onClick={() => setSelected(null)}
                >
                  <i className="ti ti-arrow-left" /> Requests
                </button>

                {/* Employee header */}
                <div className={styles.detailHeader}>
                  <div className={styles.detailEmpRow}>
                    <div className={styles.detailAvatar}>
                      {selected.employeeProfilePictureUrl ? (
                        <img src={selected.employeeProfilePictureUrl} alt="" />
                      ) : (
                        initials(
                          selected.employeeFirstName,
                          selected.employeeLastName,
                        )
                      )}
                    </div>
                    <div>
                      <h3 className={styles.detailName}>
                        {[selected.employeeFirstName, selected.employeeLastName]
                          .filter(Boolean)
                          .join(" ")}
                      </h3>
                      <p className={styles.detailEmail}>
                        {selected.employeeEmail}
                      </p>
                      <p className={styles.detailDept}>
                        {selected.department || "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setSelected(null)}
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>

                {/* Leave type + status */}
                <div className={styles.statusRow}>
                  {(() => {
                    const typeIcon =
                      LEAVE_TYPE_ICON[selected.leaveType] || "ti-calendar";
                    const cfg = leaveStatusConfig(selected.status);
                    return (
                      <>
                        <span className={styles.leaveTypeBadge}>
                          <i className={`ti ${typeIcon}`} />
                          {leaveTypeLabel(selected.leaveType)}
                        </span>
                        <span
                          className={styles.statusBadge}
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <i className={`ti ${cfg.icon}`} /> {cfg.label}
                        </span>
                      </>
                    );
                  })()}
                  <span className={styles.appliedAt}>
                    Applied {formatDate(selected.createdAt)}
                  </span>
                </div>

                {/* Stage description */}
                <p className={styles.stageDesc}>
                  {leaveStageDescription(selected)}
                </p>

                {/* Dates */}
                <div className={styles.detailCard}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>From</span>
                    <span className={styles.detailValue}>
                      {formatDate(selected.startDate)}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>To</span>
                    <span className={styles.detailValue}>
                      {formatDate(selected.endDate)}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Duration</span>
                    <span className={styles.detailValue}>
                      {selected.days} day{selected.days !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div className={styles.reasonBox}>
                  <p className={styles.reasonLabel}>Reason</p>
                  <p className={styles.reasonText}>{selected.reason}</p>
                </div>

                {/* Workflow timeline */}
                <WorkflowTimeline leave={selected} />

                {/* Employer note from previous decision */}
                {selected.adminNote &&
                  selected.status !== "PENDING_EMPLOYER" && (
                    <div className={styles.adminNoteBox}>
                      <p className={styles.reasonLabel}>Your note</p>
                      <p className={styles.reasonText}>{selected.adminNote}</p>
                    </div>
                  )}

                {/* Actions — only for PENDING_EMPLOYER */}
                {selected.status === "PENDING_EMPLOYER" && (
                  <div className={styles.actions}>
                    <div className={styles.noteField}>
                      <label>Note for employee (optional)</label>
                      <input
                        type="text"
                        placeholder="Add a note for the employee…"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                      />
                    </div>

                    <div className={styles.actionBtns}>
                      <button
                        className={styles.approveBtn}
                        onClick={() => handleApprove(selected.id)}
                        disabled={!!actioning}
                      >
                        <i className="ti ti-circle-check" />
                        {actioning === selected.id
                          ? "Approving…"
                          : "Approve leave"}
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => setShowRejectBox(true)}
                        disabled={!!actioning || showRejectBox}
                      >
                        <i className="ti ti-circle-x" />
                        Reject
                      </button>
                    </div>

                    {showRejectBox && (
                      <div className={styles.rejectBox}>
                        <label>Rejection reason (optional)</label>
                        <textarea
                          rows={3}
                          placeholder="Tell the employee why…"
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                        />
                        <div className={styles.rejectConfirmBtns}>
                          <button
                            className={styles.cancelSmallBtn}
                            onClick={() => setShowRejectBox(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className={styles.rejectConfirmBtn}
                            onClick={() => handleReject(selected.id)}
                            disabled={!!actioning}
                          >
                            {actioning === selected.id
                              ? "Rejecting…"
                              : "Confirm rejection"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <i
                  className="ti ti-calendar-event"
                  style={{ fontSize: 48, color: "var(--text-secondary)" }}
                />
                <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>
                  Select a leave request to review it
                </p>
                {byTab.PENDING.length > 0 && (
                  <p
                    style={{
                      color: "var(--accent)",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {byTab.PENDING.length} request
                    {byTab.PENDING.length > 1 ? "s" : ""} awaiting your decision
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ ON LEAVE SECTION ══════════ */}
      {section === "on-leave" && (
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="ti ti-walk" /> Currently on Leave
            </h2>
            <p className={styles.sectionSub}>
              Employees with an approved leave that covers today. Updates
              automatically — no refresh needed.
            </p>
          </div>
          <OnLeavePanel />
        </div>
      )}

      {/* ══════════ POLICIES SECTION ══════════ */}
      {section === "policies" && (
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="ti ti-settings" /> Leave Policies
            </h2>
            <p className={styles.sectionSub}>
              Control which leave types are available, how many days each
              employee gets per year, and whether cover person / HOD approval
              are required at each stage.
            </p>
          </div>
          <PolicyEditor />
        </div>
      )}

      {/* ══════════ BALANCES SECTION ══════════ */}
      {section === "balances" && (
        <div className={styles.sectionWrap}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="ti ti-chart-bar" /> Leave Balances
            </h2>
            <p className={styles.sectionSub}>
              Remaining leave days per employee for {new Date().getFullYear()}.
              Balances are deducted automatically when a leave is approved.
            </p>
          </div>
          <BalancesPanel />
        </div>
      )}
    </div>
  );
}
