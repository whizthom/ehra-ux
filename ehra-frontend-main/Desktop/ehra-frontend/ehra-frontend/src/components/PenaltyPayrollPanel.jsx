import { useState, useEffect, useCallback, Fragment } from "react";
import {
  getEmployeePenaltySummary,
  getEmployeePenaltyHistory,
  getMyPenaltySummary,
  getMyPenaltyHistory,
  pardonAttendance,
  unpardonAttendance,
} from "../api/penaltyApi";
import styles from "./PenaltyPayrollPanel.module.css";

const STATUS_STYLES = {
  PRESENT: { label: "Present", cls: "pillPresent" },
  LATE: { label: "Late", cls: "pillLate" },
  EARLY_LEAVE: { label: "Early leave", cls: "pillEarly" },
  ABSENT: { label: "Absent", cls: "pillAbsent" },
};

function formatMoney(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
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

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodLabel(s) {
  return `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`;
}

/**
 * Attendance-penalty / payroll view for one employee, for one pay period.
 *
 * viewer:
 *  - "employer": full access, can pardon/unpardon events not yet finalized
 *  - "hod":      attendance + deduction detail, no salary/net-pay figures
 *  - "self":     the employee's own view of their own record
 *
 * employeeId is required unless viewer === "self" (which always uses the
 * caller's own /penalty/me endpoints).
 */
export default function PenaltyPayrollPanel({ viewer, employeeId }) {
  const isEmployer = viewer === "employer";
  const isSelf = viewer === "self";

  const [history, setHistory] = useState([]); // finalized periods, newest first
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState(null); // null = current/live
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState("");

  const [pardonRowId, setPardonRowId] = useState(null);
  const [pardonReason, setPardonReason] = useState("");
  const [savingPardonId, setSavingPardonId] = useState(null);
  const [actionError, setActionError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = isSelf
        ? await getMyPenaltyHistory()
        : await getEmployeePenaltyHistory(employeeId);
      setHistory(data || []);
    } catch {
      // Non-fatal — the current period still loads on its own.
    } finally {
      setLoading(false);
    }
  }, [isSelf, employeeId]);

  const fetchSummary = useCallback(
    async (periodEnd) => {
      setLoadingSummary(true);
      setError("");
      try {
        const { data } = isSelf
          ? await getMyPenaltySummary(periodEnd)
          : await getEmployeePenaltySummary(employeeId, periodEnd);
        setSummary(data);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            "Couldn't load payroll data for this period.",
        );
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    },
    [isSelf, employeeId],
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchSummary(selectedPeriodEnd);
  }, [selectedPeriodEnd, fetchSummary]);

  const refreshCurrent = () => fetchSummary(selectedPeriodEnd);

  const startPardon = (eventId) => {
    setActionError("");
    setPardonReason("");
    setPardonRowId(eventId);
  };

  const cancelPardon = () => {
    setPardonRowId(null);
    setPardonReason("");
  };

  const confirmPardon = async (eventId) => {
    setSavingPardonId(eventId);
    setActionError("");
    try {
      await pardonAttendance(eventId, pardonReason.trim() || undefined);
      setPardonRowId(null);
      setPardonReason("");
      await refreshCurrent();
    } catch (err) {
      setActionError(
        err?.response?.data?.message || "Couldn't excuse this event.",
      );
    } finally {
      setSavingPardonId(null);
    }
  };

  const handleUnpardon = async (eventId) => {
    setSavingPardonId(eventId);
    setActionError("");
    try {
      await unpardonAttendance(eventId);
      await refreshCurrent();
    } catch (err) {
      setActionError(
        err?.response?.data?.message || "Couldn't reinstate this deduction.",
      );
    } finally {
      setSavingPardonId(null);
    }
  };

  if (loading && loadingSummary) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading payroll…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* ── Header: period picker ── */}
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>
            <i className="ti ti-receipt-2" aria-hidden="true" />
            Attendance &amp; pay
          </h3>
          <p className={styles.subtitle}>
            {isSelf
              ? "Your attendance-based deductions and estimated pay for this period."
              : "Attendance-based salary deductions for this period."}
          </p>
        </div>

        <select
          className={styles.periodSelect}
          value={selectedPeriodEnd || "current"}
          onChange={(e) =>
            setSelectedPeriodEnd(
              e.target.value === "current" ? null : e.target.value,
            )
          }
        >
          <option value="current">Current period (live)</option>
          {history.map((h) => (
            <option key={h.periodEnd} value={h.periodEnd}>
              {periodLabel(h)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {loadingSummary ? (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
        </div>
      ) : summary ? (
        <>
          {/* ── Status badge + period range ── */}
          <div className={styles.statusRow}>
            <span className={styles.periodRange}>{periodLabel(summary)}</span>
            {summary.finalized ? (
              <span className={`${styles.badge} ${styles.badgeFinal}`}>
                <i className="ti ti-lock-check" aria-hidden="true" />
                Finalized
                {summary.computedAt
                  ? ` · ${new Date(summary.computedAt).toLocaleDateString()}`
                  : ""}
              </span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeLive}`}>
                <i className="ti ti-clock-hour-4" aria-hidden="true" />
                Live estimate
                {summary.payoutDay
                  ? ` · closes on the ${ordinal(summary.payoutDay)}`
                  : ""}
              </span>
            )}
          </div>

          {/* ── Pay summary cards ── */}
          <div className={styles.cardsRow}>
            {summary.canViewPay ? (
              <>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Base salary</span>
                  <span className={styles.statValue}>
                    {summary.salarySet
                      ? formatMoney(summary.baseSalary)
                      : "Not set"}
                  </span>
                </div>
                <div className={`${styles.statCard} ${styles.statCardWarn}`}>
                  <span className={styles.statLabel}>Total deductions</span>
                  <span className={styles.statValue}>
                    {formatMoney(summary.totalDeduction)}
                  </span>
                </div>
                <div className={`${styles.statCard} ${styles.statCardGood}`}>
                  <span className={styles.statLabel}>
                    {summary.finalized ? "Net pay" : "Projected net pay"}
                  </span>
                  <span className={styles.statValue}>
                    {summary.salarySet ? formatMoney(summary.netPay) : "—"}
                  </span>
                </div>
              </>
            ) : (
              <div className={`${styles.statCard} ${styles.statCardWarn}`}>
                <span className={styles.statLabel}>Total deductions</span>
                <span className={styles.statValue}>
                  {formatMoney(summary.totalDeduction)}
                </span>
              </div>
            )}
          </div>

          {!summary.canViewPay && (
            <p className={styles.hodNote}>
              <i className="ti ti-info-circle" aria-hidden="true" />
              Salary and net pay figures are visible to the employer only.
            </p>
          )}
          {summary.canViewPay && !summary.salarySet && (
            <p className={styles.hodNote}>
              <i className="ti ti-info-circle" aria-hidden="true" />
              No salary has been set for this employee yet — deductions are
              still tracked, but there's nothing to net them against.
            </p>
          )}

          {/* ── Occurrence pills ── */}
          <div className={styles.pillsRow}>
            <span className={`${styles.countPill} ${styles.pillLate}`}>
              {summary.lateCount} late
            </span>
            <span className={`${styles.countPill} ${styles.pillEarly}`}>
              {summary.earlyLeaveCount} early leave
            </span>
            <span className={`${styles.countPill} ${styles.pillAbsent}`}>
              {summary.absentCount} absent
            </span>
            <span className={`${styles.countPill} ${styles.pillNeutral}`}>
              {summary.excusedByLeaveCount} on approved leave
            </span>
            <span className={`${styles.countPill} ${styles.pillPresent}`}>
              {summary.pardonedCount} pardoned
            </span>
          </div>

          {actionError && (
            <div className={styles.errorBanner}>
              <i className="ti ti-alert-circle" aria-hidden="true" />
              {actionError}
            </div>
          )}

          {/* ── Events table ── */}
          <div className={styles.tableWrap}>
            {!summary.events || summary.events.length === 0 ? (
              <div className={styles.empty}>
                <i
                  className="ti ti-calendar-off"
                  style={{ fontSize: 26 }}
                  aria-hidden="true"
                />
                <p>No attendance recorded in this period yet.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Status</th>
                    <th>Effect on pay</th>
                    {isEmployer && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {summary.events
                    .slice()
                    .reverse()
                    .map((ev) => {
                      const status =
                        STATUS_STYLES[ev.status] || STATUS_STYLES.PRESENT;
                      const canAct =
                        isEmployer &&
                        !summary.finalized &&
                        ev.status !== "PRESENT" &&
                        !ev.onApprovedLeave;
                      const isPardonFormOpen = pardonRowId === ev.id;

                      return (
                        <Fragment key={ev.id}>
                          <tr>
                            <td className={styles.dateCell}>
                              {formatDateShort(ev.date)}
                            </td>
                            <td data-label="Clock in" className={styles.muted}>
                              {formatTime(ev.clockIn)}
                            </td>
                            <td data-label="Clock out" className={styles.muted}>
                              {formatTime(ev.clockOut)}
                            </td>
                            <td data-label="Status">
                              <span
                                className={`${styles.pill} ${styles[status.cls]}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td data-label="Effect on pay">
                              {ev.onApprovedLeave ? (
                                <span className={styles.effectNeutral}>
                                  On approved leave — no charge
                                </span>
                              ) : ev.pardoned ? (
                                <span className={styles.effectGood}>
                                  Excused
                                  {ev.pardonReason
                                    ? ` — ${ev.pardonReason}`
                                    : ""}
                                </span>
                              ) : ev.penalized ? (
                                <span className={styles.effectBad}>
                                  −{formatMoney(ev.deductionAmount)}
                                </span>
                              ) : (
                                <span className={styles.effectNeutral}>—</span>
                              )}
                            </td>
                            {isEmployer && (
                              <td className={styles.actionsCell}>
                                {canAct && !ev.pardoned && (
                                  <button
                                    className={styles.linkBtn}
                                    onClick={() => startPardon(ev.id)}
                                    disabled={savingPardonId === ev.id}
                                  >
                                    Pardon
                                  </button>
                                )}
                                {canAct && ev.pardoned && (
                                  <button
                                    className={styles.linkBtnMuted}
                                    onClick={() => handleUnpardon(ev.id)}
                                    disabled={savingPardonId === ev.id}
                                  >
                                    {savingPardonId === ev.id
                                      ? "…"
                                      : "Reinstate"}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                          {isPardonFormOpen && (
                            <tr key={`${ev.id}-form`}>
                              <td
                                colSpan={isEmployer ? 6 : 5}
                                className={styles.pardonFormCell}
                              >
                                <div className={styles.pardonForm}>
                                  <input
                                    type="text"
                                    placeholder="Reason (optional) — e.g. approved verbally"
                                    value={pardonReason}
                                    onChange={(e) =>
                                      setPardonReason(e.target.value)
                                    }
                                    className={styles.pardonInput}
                                    autoFocus
                                  />
                                  <button
                                    className={styles.confirmBtn}
                                    onClick={() => confirmPardon(ev.id)}
                                    disabled={savingPardonId === ev.id}
                                  >
                                    {savingPardonId === ev.id
                                      ? "Saving…"
                                      : "Confirm"}
                                  </button>
                                  <button
                                    className={styles.cancelBtn}
                                    onClick={cancelPardon}
                                    disabled={savingPardonId === ev.id}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
