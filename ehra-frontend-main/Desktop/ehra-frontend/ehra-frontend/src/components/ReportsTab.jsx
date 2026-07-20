import { useState } from "react";
import AttendanceReportView from "./AttendanceReportView";
import PayrollReportView from "./PayrollReportView";
import LeaveReportView from "./LeaveReportView";
import DepartmentHealthReportView from "./DepartmentHealthReportView";
import WorkforceOverviewReportView from "./WorkforceOverviewReportView";
import styles from "./ReportsTab.module.css";

const REPORT_TYPES = [
  {
    key: "attendance",
    label: "Attendance & Punctuality",
    icon: "ti-clock-check",
  },
  { key: "payroll", label: "Payroll & Penalty", icon: "ti-cash" },
  { key: "leave", label: "Leave", icon: "ti-beach" },
  {
    key: "departmentHealth",
    label: "Department Health",
    icon: "ti-heartbeat",
  },
  {
    key: "workforce",
    label: "Workforce Overview",
    icon: "ti-users-group",
  },
];

// Tools > Reports. A tab switcher between report types, each rendering
// its own filters, summary cards, trend chart, and CSV/PDF export —
// see AttendanceReportView, PayrollReportView, LeaveReportView,
// DepartmentHealthReportView, and WorkforceOverviewReportView.
export default function ReportsTab({ departments = [] }) {
  const [reportType, setReportType] = useState("attendance");

  return (
    <div className={styles.wrap}>
      <div className={styles.reportTypeTabs}>
        {REPORT_TYPES.map((t) => (
          <button
            key={t.key}
            className={`${styles.reportTypeTab} ${
              reportType === t.key ? styles.reportTypeTabActive : ""
            }`}
            onClick={() => setReportType(t.key)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {reportType === "attendance" ? (
        <AttendanceReportView departments={departments} />
      ) : reportType === "payroll" ? (
        <PayrollReportView departments={departments} />
      ) : reportType === "leave" ? (
        <LeaveReportView departments={departments} />
      ) : reportType === "departmentHealth" ? (
        <DepartmentHealthReportView />
      ) : (
        <WorkforceOverviewReportView />
      )}
    </div>
  );
}
