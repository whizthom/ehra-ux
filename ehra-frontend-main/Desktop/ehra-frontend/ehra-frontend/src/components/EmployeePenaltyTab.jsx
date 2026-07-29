import { useEffect, useState, useCallback } from "react";
import { getMyPenaltySummary, getMyPenaltyHistory } from "../api/penaltyApi";
import styles from "./EmployeePenaltyTab.module.css";

function money(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Replaces the admin `<PenaltyTab>` (business-wide settings, payroll
// finalization — all ADMIN only). An employee can see their own
// deductions via GET /penalty/me and /penalty/me/history, which this uses.
export default function EmployeePenaltyTab() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [s, h] = await Promise.all([
        getMyPenaltySummary(),
        getMyPenaltyHistory(),
      ]);
      setSummary(s.data);
      setHistory(h.data);
    } catch (err) {
      console.error("Failed to load my penalty data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>My deductions</h2>
        <p className={styles.subtitle}>
          Attendance-related penalties for the current period.
        </p>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Late count</span>
              <span className={styles.summaryValue}>
                {summary?.lateCount ?? 0}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Absence count</span>
              <span className={styles.summaryValue}>
                {summary?.absentCount ?? 0}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total deducted</span>
              <span className={styles.summaryValue}>
                {money(summary?.totalDeduction)}
              </span>
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>History</h3>
            {history.length === 0 ? (
              <p className={styles.empty}>No finalized pay periods yet.</p>
            ) : (
              <div className={styles.list}>
                {history.map((h, i) => (
                  <div
                    key={`${h.periodStart}-${h.periodEnd}-${i}`}
                    className={styles.row}
                  >
                    <div className={styles.rowMain}>
                      <span className={styles.rowPeriod}>
                        {fmt(h.periodStart)} – {fmt(h.periodEnd)}
                      </span>
                      <span className={styles.rowBreakdown}>
                        Late <b>{h.lateCount ?? 0}</b> · Absent{" "}
                        <b>{h.absentCount ?? 0}</b>
                        {h.earlyLeaveCount ? (
                          <>
                            {" "}
                            · Early leave <b>{h.earlyLeaveCount}</b>
                          </>
                        ) : null}
                        {h.pardonedCount ? (
                          <>
                            {" "}
                            · Pardoned <b>{h.pardonedCount}</b>
                          </>
                        ) : null}
                      </span>

                      {/* Every deduction type that actually applied this
                          period, not just absences — late and early-leave
                          deductions were previously invisible here even
                          though they're included in the total. */}
                      {(h.lateDeductionTotal > 0 ||
                        h.earlyLeaveDeductionTotal > 0 ||
                        h.absentDeductionTotal > 0) && (
                        <span className={styles.rowDeductionNote}>
                          {h.lateDeductionTotal > 0 && (
                            <>Late: -{money(h.lateDeductionTotal)} </>
                          )}
                          {h.earlyLeaveDeductionTotal > 0 && (
                            <>
                              Early leave: -
                              {money(h.earlyLeaveDeductionTotal)}{" "}
                            </>
                          )}
                          {h.absentDeductionTotal > 0 && (
                            <>Absence: -{money(h.absentDeductionTotal)}</>
                          )}
                        </span>
                      )}

                      {/* Net pay = base salary − total deductions, exactly
                          as the backend computes and stores it on the
                          finalized PayrollRecord (PenaltyServiceImpl —
                          netPay field). Only shown when this viewer is
                          allowed to see pay figures at all (always true for
                          an employee's own history) and a salary was
                          actually on file for that period. */}
                      {h.canViewPay &&
                        (h.salarySet ? (
                          <span className={styles.rowNetPayNote}>
                            Base salary {money(h.baseSalary)} − deductions{" "}
                            {money(h.totalDeduction)} ={" "}
                            <b>Net pay {money(h.netPay)}</b>
                          </span>
                        ) : (
                          <span className={styles.rowNoSalaryNote}>
                            No salary was on file for this period.
                          </span>
                        ))}
                    </div>
                    <span className={styles.rowAmount}>
                      -{money(h.totalDeduction)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
