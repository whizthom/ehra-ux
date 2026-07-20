import { useEffect, useState, useCallback } from "react";
import {
  getEmployeePenaltySummary,
  getEmployeePenaltyHistory,
  pardonAttendance,
  unpardonAttendance,
} from "../api/penaltyApi";
import { updateEmployeeSalary } from "../api/employmentApi";
import styles from "./PayrollTab.module.css";

const STATUS_LABEL = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early leave",
  ABSENT: "Absent",
};

function money(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Payroll section on an employee's full profile page — salary, the
 * current pay period's deduction breakdown (with pardon controls), and
 * finalized past periods.
 *
 * Salary and pardon/unpardon are employer-only actions (the server
 * enforces this — see PenaltyController); an HOD sees everything else
 * (attendance/deduction detail) but never the salary figure or pardon
 * buttons, per `canViewPay` on the summary response.
 */
export default function PayrollTab({ employeeId, canManage }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryValue, setSalaryValue] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState("");

  const [pardonTarget, setPardonTarget] = useState(null);
  const [pardonReason, setPardonReason] = useState("");
  const [pardonBusyId, setPardonBusyId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [summaryRes, historyRes] = await Promise.all([
        getEmployeePenaltySummary(employeeId),
        getEmployeePenaltyHistory(employeeId),
      ]);
      setSummary(summaryRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Failed to load payroll data:", err);
      setError("Couldn't load payroll information.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openSalaryEditor = () => {
    setSalaryValue(
      summary?.baseSalary != null ? String(summary.baseSalary) : "",
    );
    setSalaryError("");
    setEditingSalary(true);
  };

  const saveSalary = async () => {
    const trimmed = salaryValue.trim();
    const num = Number(trimmed);
    if (trimmed === "" || Number.isNaN(num) || num < 0) {
      setSalaryError("Enter a valid, non-negative amount.");
      return;
    }
    setSavingSalary(true);
    try {
      await updateEmployeeSalary(employeeId, num);
      setEditingSalary(false);
      fetchAll();
    } catch (err) {
      const data = err?.response?.data;
      setSalaryError(
        typeof data === "string"
          ? data
          : data?.message || "Couldn't update salary.",
      );
    } finally {
      setSavingSalary(false);
    }
  };

  const confirmPardon = async () => {
    if (!pardonTarget) return;
    setPardonBusyId(pardonTarget.id);
    try {
      await pardonAttendance(pardonTarget.id, pardonReason.trim() || undefined);
      setPardonTarget(null);
      setPardonReason("");
      fetchAll();
    } catch (err) {
      console.error("Failed to pardon attendance event:", err);
    } finally {
      setPardonBusyId(null);
    }
  };

  const handleUnpardon = async (eventId) => {
    setPardonBusyId(eventId);
    try {
      await unpardonAttendance(eventId);
      fetchAll();
    } catch (err) {
      console.error("Failed to unpardon attendance event:", err);
    } finally {
      setPardonBusyId(null);
    }
  };

  if (loading) return <p className={styles.empty}>Loading payroll…</p>;
  if (error) return <div className={styles.errorBox}>{error}</div>;
  if (!summary)
    return <p className={styles.empty}>No payroll data available.</p>;

  const events = summary.events || [];

  return (
    <div className={styles.wrap}>
      {/* ── Salary ── */}
      {summary.canViewPay && (
        <div className={styles.card}>
          <div className={styles.salaryHeader}>
            <div>
              <span className={styles.cardLabel}>Base salary</span>
              {editingSalary ? (
                <div className={styles.salaryEditRow}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.salaryInput}
                    value={salaryValue}
                    onChange={(e) => setSalaryValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={saveSalary}
                    disabled={savingSalary}
                  >
                    {savingSalary ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelLink}
                    onClick={() => setEditingSalary(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className={styles.salaryValueRow}>
                  <span className={styles.salaryValue}>
                    {summary.salarySet ? money(summary.baseSalary) : "Not set"}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className={styles.editLink}
                      onClick={openSalaryEditor}
                    >
                      <i className="ti ti-edit" />{" "}
                      {summary.salarySet ? "Edit" : "Set salary"}
                    </button>
                  )}
                </div>
              )}
              {salaryError && (
                <div className={styles.errorBoxSmall}>{salaryError}</div>
              )}
            </div>
            <div className={styles.netPay}>
              <span className={styles.cardLabel}>Net pay this period</span>
              <span className={styles.netPayValue}>
                {money(summary.netPay)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Current period summary ── */}
      <div className={styles.card}>
        <div className={styles.periodHeader}>
          <div>
            <span className={styles.cardLabel}>Current pay period</span>
            <span className={styles.periodRange}>
              {fmtDate(summary.periodStart)} – {fmtDate(summary.periodEnd)}
            </span>
          </div>
          <span
            className={`${styles.periodBadge} ${summary.finalized ? styles.finalized : styles.live}`}
          >
            {summary.finalized ? "Finalized" : "In progress"}
          </span>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{summary.lateCount}</span>
            <span className={styles.statLabel}>Late</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{summary.earlyLeaveCount}</span>
            <span className={styles.statLabel}>Early leave</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{summary.absentCount}</span>
            <span className={styles.statLabel}>Absent</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{summary.pardonedCount}</span>
            <span className={styles.statLabel}>Pardoned</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {summary.excusedByLeaveCount}
            </span>
            <span className={styles.statLabel}>Excused (leave)</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValueDanger}>
              {money(summary.totalDeduction)}
            </span>
            <span className={styles.statLabel}>Total deducted</span>
          </div>
        </div>
      </div>

      {/* ── Attendance events (this period) ── */}
      <div className={styles.card}>
        <h3 className={styles.panelTitle}>This period's attendance</h3>
        {events.length === 0 ? (
          <p className={styles.empty}>
            No attendance events recorded yet this period.
          </p>
        ) : (
          <div className={styles.list}>
            {events.map((e) => (
              <div key={e.id} className={styles.eventRow}>
                <div className={styles.eventMain}>
                  <span className={styles.eventDate}>{fmtDate(e.date)}</span>
                  <span className={styles.eventStatus}>
                    {STATUS_LABEL[e.status] || e.status}
                  </span>
                  <span className={styles.eventTimes}>
                    {fmtTime(e.clockIn)} – {fmtTime(e.clockOut)}
                  </span>
                </div>

                <div className={styles.eventTags}>
                  {e.onApprovedLeave && (
                    <span className={styles.tagLeave}>On approved leave</span>
                  )}
                  {e.pardoned && (
                    <span className={styles.tagPardoned}>
                      Pardoned{e.pardonedBy ? ` by ${e.pardonedBy}` : ""}
                    </span>
                  )}
                  {e.penalized && !e.pardoned && (
                    <span className={styles.tagDeducted}>
                      -{money(e.deductionAmount)}
                    </span>
                  )}
                </div>

                {canManage &&
                  e.penalized &&
                  (e.pardoned ? (
                    <button
                      type="button"
                      className={styles.unpardonBtn}
                      disabled={pardonBusyId === e.id}
                      onClick={() => handleUnpardon(e.id)}
                    >
                      Undo pardon
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.pardonBtn}
                      disabled={pardonBusyId === e.id}
                      onClick={() => {
                        setPardonTarget(e);
                        setPardonReason("");
                      }}
                    >
                      Pardon
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Past pay periods ── */}
      <div className={styles.card}>
        <h3 className={styles.panelTitle}>Past pay periods</h3>
        {history.length === 0 ? (
          <p className={styles.empty}>No finalized periods yet.</p>
        ) : (
          <div className={styles.list}>
            {history.map((h, i) => (
              <div key={i} className={styles.periodRow}>
                <span className={styles.periodRowRange}>
                  {fmtDate(h.periodStart)} – {fmtDate(h.periodEnd)}
                </span>
                <span className={styles.periodRowDeduction}>
                  -{money(h.totalDeduction)}
                </span>
                {h.canViewPay && (
                  <span className={styles.periodRowNet}>
                    Net {money(h.netPay)}
                  </span>
                )}
                <span
                  className={`${styles.periodBadge} ${h.finalized ? styles.finalized : styles.live}`}
                >
                  {h.finalized ? "Finalized" : "In progress"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pardon confirmation ── */}
      {pardonTarget && (
        <div className={styles.overlay} onClick={() => setPardonTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Pardon this deduction?</h3>
            <p className={styles.modalSubtitle}>
              {fmtDate(pardonTarget.date)} ·{" "}
              {STATUS_LABEL[pardonTarget.status] || pardonTarget.status} · -
              {money(pardonTarget.deductionAmount)}
            </p>
            <textarea
              className={styles.modalTextarea}
              rows={3}
              placeholder="Reason (optional)"
              value={pardonReason}
              onChange={(e) => setPardonReason(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelLink}
                onClick={() => setPardonTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={confirmPardon}
                disabled={pardonBusyId === pardonTarget.id}
              >
                {pardonBusyId === pardonTarget.id
                  ? "Pardoning…"
                  : "Confirm pardon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
