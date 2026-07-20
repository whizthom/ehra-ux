import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPenaltySettings,
  updatePenaltySettings,
  getBusinessOverview,
  getFinalizedPeriods,
  finalizePayrollNow,
} from "../api/penaltyApi";
import styles from "./PenaltyTab.module.css";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function initials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

export default function PenaltyTab() {
  const navigate = useNavigate();

  // ── Settings ──────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { data } = await getPenaltySettings();
      setSettings(data);
      setForm({
        lateDeduction: String(data.lateDeduction ?? 0),
        earlyLeaveDeduction: String(data.earlyLeaveDeduction ?? 0),
        absentDeduction: String(data.absentDeduction ?? 0),
        payoutDay: String(data.payoutDay ?? 28),
        enabled: data.enabled !== false,
      });
    } catch {
      setSettingsError("Couldn't load penalty settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async () => {
    setSettingsError("");
    const late = Number(form.lateDeduction);
    const early = Number(form.earlyLeaveDeduction);
    const absent = Number(form.absentDeduction);
    const payoutDay = Number(form.payoutDay);

    if ([late, early, absent].some((n) => Number.isNaN(n) || n < 0)) {
      setSettingsError(
        "Deduction amounts must be valid, non-negative numbers.",
      );
      return;
    }
    if (!Number.isInteger(payoutDay) || payoutDay < 1 || payoutDay > 31) {
      setSettingsError("Payout day must be a whole number between 1 and 31.");
      return;
    }

    setSavingSettings(true);
    try {
      const { data } = await updatePenaltySettings({
        lateDeduction: late,
        earlyLeaveDeduction: early,
        absentDeduction: absent,
        payoutDay,
        enabled: form.enabled,
      });
      setSettings(data);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
      fetchOverview(selectedPeriodEnd);
    } catch (err) {
      setSettingsError(
        err?.response?.data?.message || "Couldn't save penalty settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Business overview ────────────────────────────────────────────────
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState(null); // null = current/live
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [rowsError, setRowsError] = useState("");
  const [search, setSearch] = useState("");
  const [runningNow, setRunningNow] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  const fetchPeriods = useCallback(async () => {
    try {
      const { data } = await getFinalizedPeriods();
      setPeriods(data || []);
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchOverview = useCallback(async (periodEnd) => {
    setLoadingRows(true);
    setRowsError("");
    try {
      const { data } = await getBusinessOverview(periodEnd);
      setRows(data || []);
    } catch {
      setRowsError("Couldn't load the payroll overview.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    fetchOverview(selectedPeriodEnd);
  }, [selectedPeriodEnd, fetchOverview]);

  const handleRunNow = async () => {
    setRunningNow(true);
    setRunMessage("");
    try {
      await finalizePayrollNow();
      setRunMessage("Payroll finalized for the current period so far.");
      await Promise.all([fetchPeriods(), fetchOverview(selectedPeriodEnd)]);
      setTimeout(() => setRunMessage(""), 4000);
    } catch (err) {
      setRunMessage(
        err?.response?.data?.message || "Couldn't finalize payroll right now.",
      );
    } finally {
      setRunningNow(false);
    }
  };

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Custom "period" dropdown panel (replaces the native <select>) ──────
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef(null);

  useEffect(() => {
    if (!periodMenuOpen) return;
    const handleOutside = (e) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target)) {
        setPeriodMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setPeriodMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [periodMenuOpen]);

  const selectedPeriodLabel = selectedPeriodEnd
    ? `Period ending ${formatDate(selectedPeriodEnd)}`
    : "Current period (live)";

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const name =
      `${r.employeeFirstName} ${r.employeeLastName || ""}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      (r.departmentName || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const totals = rows.reduce(
    (acc, r) => ({
      deductions: acc.deductions + Number(r.totalDeduction || 0),
      netPay: acc.netPay + Number(r.netPay || 0),
    }),
    { deductions: 0, netPay: 0 },
  );

  const currentRangeLabel =
    rows.length > 0
      ? `${formatDate(rows[0].periodStart)} – ${formatDate(rows[0].periodEnd)}`
      : null;

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Penalty &amp; Payroll</h2>
          <p className={styles.subheading}>
            Set attendance deduction rules and see what each employee should be
            paid this period.
          </p>
        </div>
        <button
          className={styles.settingsToggle}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <i className="ti ti-adjustments" aria-hidden="true" />
          {settingsOpen ? "Hide settings" : "Deduction settings"}
        </button>
      </div>

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <div className={styles.settingsCard}>
          {loadingSettings || !form ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <>
              <div className={styles.settingsHeadRow}>
                <div>
                  <h3 className={styles.settingsTitle}>How deductions work</h3>
                  <p className={styles.settingsHint}>
                    Set an amount to deduct from an employee's salary for each
                    late arrival, early leave, or full absence. Deductions never
                    apply on a day the employee is on approved leave, and any
                    single event can be pardoned individually.
                  </p>
                </div>
                <label className={styles.toggleRow}>
                  <span>{form.enabled ? "Enabled" : "Disabled"}</span>
                  <span
                    className={`${styles.toggleTrack} ${
                      form.enabled ? styles.toggleOn : ""
                    }`}
                    onClick={() =>
                      setForm((f) => ({ ...f, enabled: !f.enabled }))
                    }
                  >
                    <span className={styles.toggleThumb} />
                  </span>
                </label>
              </div>

              <div className={styles.fieldsGrid}>
                <div className={styles.field}>
                  <label>Late arrival deduction</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.lateDeduction}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lateDeduction: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Early leave deduction</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.earlyLeaveDeduction}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        earlyLeaveDeduction: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Full absence deduction</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.absentDeduction}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        absentDeduction: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label>Payout day of month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={form.payoutDay}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, payoutDay: e.target.value }))
                    }
                  />
                  <span className={styles.fieldHint}>
                    Pay periods run from the day after last payout to this day
                    each month (defaults to the 28th).
                  </span>
                </div>
              </div>

              {settingsError && (
                <div className={styles.errorBanner}>
                  <i className="ti ti-alert-circle" aria-hidden="true" />
                  {settingsError}
                </div>
              )}

              <div className={styles.settingsActions}>
                <button
                  className={styles.saveBtn}
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? "Saving…" : "Save settings"}
                </button>
                {settingsSaved && (
                  <span className={styles.savedTag}>
                    <i className="ti ti-check" aria-hidden="true" /> Saved
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Overview toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search employee or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.periodDropdown} ref={periodMenuRef}>
          <button
            type="button"
            className={styles.periodTrigger}
            onClick={() => setPeriodMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={periodMenuOpen}
          >
            <i className="ti ti-calendar-time" aria-hidden="true" />
            <span className={styles.periodTriggerLabel}>
              {selectedPeriodLabel}
            </span>
            <i
              className={`ti ti-chevron-down ${styles.periodChevron} ${
                periodMenuOpen ? styles.periodChevronOpen : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {periodMenuOpen && (
            <div className={styles.periodMenu} role="listbox">
              <button
                type="button"
                role="option"
                aria-selected={!selectedPeriodEnd}
                className={`${styles.periodOption} ${
                  !selectedPeriodEnd ? styles.periodOptionActive : ""
                }`}
                onClick={() => {
                  setSelectedPeriodEnd(null);
                  setPeriodMenuOpen(false);
                }}
              >
                <i className="ti ti-bolt" aria-hidden="true" />
                <span>Current period (live)</span>
                {!selectedPeriodEnd && (
                  <i
                    className={`ti ti-check ${styles.periodCheck}`}
                    aria-hidden="true"
                  />
                )}
              </button>

              {periods.length > 0 && <div className={styles.periodDivider} />}

              {periods.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="option"
                  aria-selected={selectedPeriodEnd === p}
                  className={`${styles.periodOption} ${
                    selectedPeriodEnd === p ? styles.periodOptionActive : ""
                  }`}
                  onClick={() => {
                    setSelectedPeriodEnd(p);
                    setPeriodMenuOpen(false);
                  }}
                >
                  <i className="ti ti-calendar-event" aria-hidden="true" />
                  <span>Period ending {formatDate(p)}</span>
                  {selectedPeriodEnd === p && (
                    <i
                      className={`ti ti-check ${styles.periodCheck}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={styles.runBtn}
          onClick={handleRunNow}
          disabled={runningNow}
          title="Finalize the current period now instead of waiting for the payout day"
        >
          <i className="ti ti-player-play" aria-hidden="true" />
          {runningNow ? "Running…" : "Run payroll now"}
        </button>
      </div>

      {runMessage && <div className={styles.runMessage}>{runMessage}</div>}

      {/* ── Summary strip ── */}
      {!loadingRows && rows.length > 0 && (
        <div className={styles.summaryStrip}>
          <div>
            <span className={styles.summaryLabel}>Period</span>
            <span className={styles.summaryValue}>{currentRangeLabel}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Employees</span>
            <span className={styles.summaryValue}>{rows.length}</span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Total deductions</span>
            <span className={`${styles.summaryValue} ${styles.warnText}`}>
              {formatMoney(totals.deductions)}
            </span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Total net pay</span>
            <span className={`${styles.summaryValue} ${styles.goodText}`}>
              {formatMoney(totals.netPay)}
            </span>
          </div>
          <div>
            <span className={styles.summaryLabel}>Status</span>
            <span
              className={`${styles.badge} ${
                rows[0]?.finalized ? styles.badgeFinal : styles.badgeLive
              }`}
            >
              {rows[0]?.finalized
                ? "Finalized"
                : `Live · closes on the ${ordinal(rows[0]?.payoutDay || 28)}`}
            </span>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrap}>
        {loadingRows ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
          </div>
        ) : rowsError ? (
          <div className={styles.errorBanner}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {rowsError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className={styles.empty}>
            <i
              className="ti ti-users"
              style={{ fontSize: 28 }}
              aria-hidden="true"
            />
            <p>No employees match your search.</p>
          </div>
        ) : (
          <table className={`${styles.table} ${styles.desktopTable}`}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Late</th>
                <th>Early</th>
                <th>Absent</th>
                <th>Pardoned</th>
                <th>Deductions</th>
                <th>Net pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.employeeId}
                  className={styles.clickableRow}
                  onClick={() =>
                    navigate(`/employees/${r.employeeId}`, {
                      state: { from: "Penalty", activeNav: "Penalty" },
                    })
                  }
                >
                  <td>
                    <div className={styles.empCell}>
                      <div className={styles.avatar}>
                        {r.employeeProfilePictureUrl ? (
                          <img src={r.employeeProfilePictureUrl} alt="" />
                        ) : (
                          initials(r.employeeFirstName, r.employeeLastName)
                        )}
                      </div>
                      <span className={styles.empName}>
                        {r.employeeFirstName} {r.employeeLastName}
                      </span>
                    </div>
                  </td>
                  <td className={styles.deptCell}>
                    {r.departmentName || "Unassigned"}
                  </td>
                  <td>{r.lateCount}</td>
                  <td>{r.earlyLeaveCount}</td>
                  <td>{r.absentCount}</td>
                  <td>{r.pardonedCount}</td>
                  <td className={styles.warnText}>
                    {formatMoney(r.totalDeduction)}
                  </td>
                  <td className={styles.goodText}>
                    {r.salarySet ? formatMoney(r.netPay) : "No salary set"}
                  </td>
                  <td className={styles.chevronCell}>
                    <i className="ti ti-chevron-right" aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Mobile: expand/collapse cards, closed by default ── */}
        {!loadingRows && !rowsError && filteredRows.length > 0 && (
          <div className={styles.mobileCards}>
            {filteredRows.map((r) => {
              const isOpen = expandedIds.has(r.employeeId);
              return (
                <div key={r.employeeId} className={styles.empCard}>
                  <button
                    type="button"
                    className={styles.empCardHead}
                    onClick={() => toggleExpanded(r.employeeId)}
                    aria-expanded={isOpen}
                  >
                    <div className={styles.avatar}>
                      {r.employeeProfilePictureUrl ? (
                        <img src={r.employeeProfilePictureUrl} alt="" />
                      ) : (
                        initials(r.employeeFirstName, r.employeeLastName)
                      )}
                    </div>
                    <div className={styles.empCardHeadText}>
                      <span className={styles.empName}>
                        {r.employeeFirstName} {r.employeeLastName}
                      </span>
                      <span className={styles.empCardSub}>
                        {r.departmentName || "Unassigned"}
                      </span>
                    </div>
                    <i
                      className={`ti ti-chevron-down ${styles.expandIcon} ${
                        isOpen ? styles.expandIconOpen : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className={styles.empCardBody}>
                      <div className={styles.empStatGrid}>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>Late</span>
                          <span className={styles.empStatVal}>
                            {r.lateCount}
                          </span>
                        </div>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>Early</span>
                          <span className={styles.empStatVal}>
                            {r.earlyLeaveCount}
                          </span>
                        </div>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>Absent</span>
                          <span className={styles.empStatVal}>
                            {r.absentCount}
                          </span>
                        </div>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>Pardoned</span>
                          <span className={styles.empStatVal}>
                            {r.pardonedCount}
                          </span>
                        </div>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>
                            Deductions
                          </span>
                          <span
                            className={`${styles.empStatVal} ${styles.warnText}`}
                          >
                            {formatMoney(r.totalDeduction)}
                          </span>
                        </div>
                        <div className={styles.empStat}>
                          <span className={styles.empStatLabel}>Net pay</span>
                          <span
                            className={`${styles.empStatVal} ${styles.goodText}`}
                          >
                            {r.salarySet
                              ? formatMoney(r.netPay)
                              : "No salary set"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.viewProfileBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/employees/${r.employeeId}`, {
                            state: { from: "Penalty", activeNav: "Penalty" },
                          });
                        }}
                      >
                        <i className="ti ti-user" aria-hidden="true" />
                        View profile
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
