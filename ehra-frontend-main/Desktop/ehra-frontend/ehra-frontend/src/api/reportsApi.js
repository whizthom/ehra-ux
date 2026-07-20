import API from "./authApi";

export const getAttendanceReport = (from, to, departmentId) =>
  API.get("/reports/attendance", {
    params: { from, to, ...(departmentId ? { departmentId } : {}) },
  });

// Both export helpers fetch the file as a blob (so the auth header still
// gets attached by the axios interceptor) and then trigger a normal
// browser download — a plain <a href=".../export.csv"> wouldn't carry the
// Authorization header and would just 401.
async function downloadBlob(url, params, filename) {
  const { data } = await API.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const downloadAttendanceCsv = (from, to, departmentId) =>
  downloadBlob(
    "/reports/attendance/export.csv",
    { from, to, ...(departmentId ? { departmentId } : {}) },
    `attendance-report-${from}-to-${to}.csv`
  );

export const downloadAttendancePdf = (from, to, departmentId) =>
  downloadBlob(
    "/reports/attendance/export.pdf",
    { from, to, ...(departmentId ? { departmentId } : {}) },
    `attendance-report-${from}-to-${to}.pdf`
  );

// ── Payroll & Penalty ───────────────────────────────────────────────────

export const getPayrollReport = (departmentId, periods) =>
  API.get("/reports/payroll", {
    params: {
      ...(departmentId ? { departmentId } : {}),
      ...(periods ? { periods } : {}),
    },
  });

export const downloadPayrollCsv = (departmentId, periods) =>
  downloadBlob(
    "/reports/payroll/export.csv",
    {
      ...(departmentId ? { departmentId } : {}),
      ...(periods ? { periods } : {}),
    },
    `payroll-report-${new Date().toISOString().slice(0, 10)}.csv`
  );

export const downloadPayrollPdf = (departmentId, periods) =>
  downloadBlob(
    "/reports/payroll/export.pdf",
    {
      ...(departmentId ? { departmentId } : {}),
      ...(periods ? { periods } : {}),
    },
    `payroll-report-${new Date().toISOString().slice(0, 10)}.pdf`
  );

// ── Leave ────────────────────────────────────────────────────────────────

export const getLeaveReport = (from, to, departmentId) =>
  API.get("/reports/leave", {
    params: { from, to, ...(departmentId ? { departmentId } : {}) },
  });

export const downloadLeaveCsv = (from, to, departmentId) =>
  downloadBlob(
    "/reports/leave/export.csv",
    { from, to, ...(departmentId ? { departmentId } : {}) },
    `leave-report-${from}-to-${to}.csv`
  );

export const downloadLeavePdf = (from, to, departmentId) =>
  downloadBlob(
    "/reports/leave/export.pdf",
    { from, to, ...(departmentId ? { departmentId } : {}) },
    `leave-report-${from}-to-${to}.pdf`
  );

// ── Department Health ─────────────────────────────────────────────────────

export const getDepartmentHealthReport = () =>
  API.get("/reports/department-health");

export const downloadDepartmentHealthCsv = () =>
  downloadBlob(
    "/reports/department-health/export.csv",
    {},
    `department-health-${new Date().toISOString().slice(0, 10)}.csv`
  );

export const downloadDepartmentHealthPdf = () =>
  downloadBlob(
    "/reports/department-health/export.pdf",
    {},
    `department-health-${new Date().toISOString().slice(0, 10)}.pdf`
  );

// ── Workforce Overview ─────────────────────────────────────────────────────

export const getWorkforceReport = () => API.get("/reports/workforce");

export const downloadWorkforceCsv = () =>
  downloadBlob(
    "/reports/workforce/export.csv",
    {},
    `workforce-overview-${new Date().toISOString().slice(0, 10)}.csv`
  );

export const downloadWorkforcePdf = () =>
  downloadBlob(
    "/reports/workforce/export.pdf",
    {},
    `workforce-overview-${new Date().toISOString().slice(0, 10)}.pdf`
  );