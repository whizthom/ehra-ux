import { useState, useEffect } from "react";

import { getBusinessBranchDashboard } from "../api/branchApi";
import styles from "./BusinessBranchDashboard.module.css";

function StatCard({ icon, colorClass, value, label }) {
  return (
    <div className={styles.statCard}>
      {" "}
      <span
        className={`$ {
                styles.statIcon
            }

            $ {
                colorClass
            }

            `}
      >
        {" "}
        <i
          className={`ti $ {
                icon
            }

            `}
          aria-hidden="true"
        />{" "}
      </span>{" "}
      <div>
        {" "}
        <div className={styles.statValue}> {value}</div>{" "}
        <div className={styles.statLabel}> {label}</div>{" "}
      </div>{" "}
    </div>
  );
}

export default function BusinessBranchDashboard({ onBack, onOpenBranch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getBusinessBranchDashboard()
      .then(({ data }) => !cancelled && setData(data))
      .catch(
        () =>
          !cancelled && setError("Couldn't load the business-wide dashboard."),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      {" "}
      <button type="button" className={styles.backBtn} onClick={onBack}>
        {" "}
        <i className="ti ti-arrow-left" aria-hidden="true" /> Back to
        branches{" "}
      </button>{" "}
      <div className={styles.header}>
        {" "}
        <h2 className={styles.title}>All branches</h2>{" "}
        <p className={styles.subtitle}>
          {" "}
          A business-wide snapshot across every branch, today.{" "}
        </p>{" "}
      </div>{" "}
      {loading && (
        <div className={styles.loadingWrap}>
          {" "}
          <div className={styles.spinner} />{" "}
        </div>
      )}
      {!loading && error && <div className={styles.errorState}> {error}</div>}
      {!loading && !error && data && (
        <>
          {" "}
          <section className={styles.section}>
            {" "}
            <h4 className={styles.sectionTitle}>
              Branches &amp; employees
            </h4>{" "}
            <div className={styles.statsRow}>
              {" "}
              <StatCard
                icon="ti-building-store"
                colorClass={styles.colorIndigo}
                value={data.totalBranches}
                label="Total branches"
              />{" "}
              <StatCard
                icon="ti-circle-check"
                colorClass={styles.colorGreen}
                value={data.activeBranches}
                label="Active branches"
              />{" "}
              <StatCard
                icon="ti-users"
                colorClass={styles.colorIndigo}
                value={data.totalEmployees}
                label="Total employees"
              />{" "}
              <StatCard
                icon="ti-user-question"
                colorClass={styles.colorGray}
                value={data.unassignedEmployees}
                label="Not assigned to a branch"
              />{" "}
            </div>{" "}
          </section>{" "}
          <section className={styles.section}>
            {" "}
            <h4 className={styles.sectionTitle}>
              Today's attendance, business-wide
            </h4>
            <div className={styles.statsRow}>
              {" "}
              <StatCard
                icon="ti-circle-check"
                colorClass={styles.colorGreen}
                value={data.presentToday}
                label="Present"
              />{" "}
              <StatCard
                icon="ti-clock-exclamation"
                colorClass={styles.colorAmber}
                value={data.lateToday}
                label="Late"
              />{" "}
              <StatCard
                icon="ti-circle-x"
                colorClass={styles.colorRed}
                value={data.absentToday}
                label="Absent"
              />{" "}
              <StatCard
                icon="ti-door-exit"
                colorClass={styles.colorAmber}
                value={data.earlyLeaveToday}
                label="Early leave"
              />{" "}
              <StatCard
                icon="ti-user-question"
                colorClass={styles.colorGray}
                value={data.notYetClockedInToday}
                label="Not clocked in yet"
              />{" "}
            </div>{" "}
          </section>{" "}
          <section className={styles.section}>
            {" "}
            <h4 className={styles.sectionTitle}>Leave</h4>{" "}
            <div className={styles.statsRow}>
              {" "}
              <StatCard
                icon="ti-beach"
                colorClass={styles.colorIndigo}
                value={data.onLeaveToday}
                label="On leave today"
              />{" "}
              <StatCard
                icon="ti-hourglass"
                colorClass={styles.colorAmber}
                value={data.pendingLeaveRequests}
                label="Pending requests"
              />{" "}
            </div>{" "}
          </section>{" "}
          <section className={styles.section}>
            {" "}
            <h4 className={styles.sectionTitle}>Compare branches</h4>{" "}
            {data.branches.length === 0 ? (
              <div className={styles.emptyCompare}>No branches yet.</div>
            ) : (
              <div className={styles.compareTable}>
                {" "}
                <div className={styles.compareHeaderRow}>
                  {" "}
                  <span>Branch</span> <span>Status</span> <span>Employees</span>{" "}
                  <span>Present</span> <span>Late</span> <span>Absent</span>{" "}
                  <span>On leave</span>{" "}
                </div>{" "}
                {data.branches.map((b) => (
                  <button
                    type="button"
                    key={b.branchId}
                    className={styles.compareRow}
                    onClick={() => onOpenBranch(b.branchId)}
                  >
                    {" "}
                    <span className={styles.compareBranchName}>
                      {" "}
                      {b.branchName}
                    </span>{" "}
                    <span>
                      {" "}
                      <span
                        className={`$ {
                                        styles.miniBadge
                                    }

                                    $ {
                                        b.status==="ACTIVE" ? styles.miniBadgeActive : styles.miniBadgeInactive
                                    }

                                    `}
                      >
                        {" "}
                        {b.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>{" "}
                    </span>{" "}
                    <span> {b.employeeCount}</span>{" "}
                    <span> {b.presentToday}</span> <span> {b.lateToday}</span>{" "}
                    <span> {b.absentToday}</span>{" "}
                    <span> {b.onLeaveToday}</span>{" "}
                  </button>
                ))}
              </div>
            )}
          </section>{" "}
        </>
      )}
    </div>
  );
}
