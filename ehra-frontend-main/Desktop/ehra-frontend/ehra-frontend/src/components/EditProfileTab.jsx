import { useState, useEffect, useCallback, useRef } from "react";
import {
  updateEmploymentType,
  updateEmployeePosition,
  updateEmployeeSalary,
} from "../api/employmentApi";
import { getDepartments } from "../api/departmentApi";
import DepartmentCell from "./DepartmentCell";
import empStyles from "./EmploymentTab.module.css";
import styles from "./EditProfileTab.module.css";

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * "Edit Profile" tab on the employee profile page.
 *
 * Lets the employer or the employee's HOD change:
 *   - Employment type (Full-time / Part-time)
 *   - Department — employer only
 *   - Salary — employer only, employee is notified of increases/decreases
 *   - Position (job title)
 *
 * Every change here takes effect immediately (no approval queue) for both
 * the employer and an HOD, except an HOD can never edit these fields for a
 * fellow HOD — the server enforces this and this component mirrors it for
 * the employment type and position controls (department and salary are
 * hidden from HODs entirely, per business rule).
 */
export default function EditProfileTab({
  employeeId,
  profile,
  mode = "employer",
  onProfileUpdate,
}) {
  const isEmployer = mode === "employer";
  const targetIsHod = profile.role === "HOD";
  const locked = mode === "hod" && targetIsHod;

  // ── Employment type ──────────────────────────────────────────────────
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState("");

  const isPartTime = profile.employmentType === "PART_TIME";

  const handleTypeChange = async (type) => {
    if (locked || type === profile.employmentType) return;
    setSavingType(true);
    setTypeError("");
    try {
      const { data } = await updateEmploymentType(employeeId, type);
      onProfileUpdate({ employmentType: data.employmentType });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update employment type.";
      setTypeError(
        typeof msg === "string" ? msg : "Could not update employment type.",
      );
    } finally {
      setSavingType(false);
    }
  };

  // ── Department (employer only) ───────────────────────────────────────
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(isEmployer);

  const fetchDepartments = useCallback(async () => {
    if (!isEmployer) return;
    try {
      setDeptLoading(true);
      const { data } = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to load departments:", err);
    } finally {
      setDeptLoading(false);
    }
  }, [isEmployer]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleDepartmentAssigned = (_id, data) => {
    onProfileUpdate({
      departmentId: data.departmentId ?? null,
      departmentName: data.department || "Unassigned",
    });
  };

  // ── Salary (employer only) ───────────────────────────────────────────
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryValue, setSalaryValue] = useState(
    profile.salary != null ? String(profile.salary) : "",
  );
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState("");
  const [salarySavedMsg, setSalarySavedMsg] = useState("");
  const salaryInputRef = useRef(null);

  useEffect(() => {
    if (!editingSalary) {
      setSalaryValue(profile.salary != null ? String(profile.salary) : "");
    }
  }, [profile.salary, editingSalary]);

  useEffect(() => {
    if (editingSalary) salaryInputRef.current?.focus();
  }, [editingSalary]);

  const handleSaveSalary = async () => {
    const trimmed = salaryValue.trim();
    if (trimmed === "") {
      setSalaryError("Salary is required.");
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 0) {
      setSalaryError("Enter a valid, non-negative amount.");
      return;
    }
    if (profile.salary != null && num === Number(profile.salary)) {
      setEditingSalary(false);
      return;
    }
    setSavingSalary(true);
    setSalaryError("");
    try {
      const { data } = await updateEmployeeSalary(employeeId, num);
      onProfileUpdate({ salary: data.salary });
      setEditingSalary(false);
      const label =
        data.direction === "INCREASED"
          ? "Increased"
          : data.direction === "DECREASED"
            ? "Decreased"
            : "Set";
      setSalarySavedMsg(
        `${label} — ${profile.firstName || "employee"} notified`,
      );
      setTimeout(() => setSalarySavedMsg(""), 3000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update salary.";
      setSalaryError(
        typeof msg === "string" ? msg : "Could not update salary.",
      );
    } finally {
      setSavingSalary(false);
    }
  };

  const handleSalaryKeyDown = (e) => {
    if (e.key === "Enter") handleSaveSalary();
    if (e.key === "Escape") {
      setEditingSalary(false);
      setSalaryValue(profile.salary != null ? String(profile.salary) : "");
      setSalaryError("");
    }
  };

  // ── Position ──────────────────────────────────────────────────────────
  const [editingPosition, setEditingPosition] = useState(false);
  const [positionValue, setPositionValue] = useState(profile.position || "");
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionError, setPositionError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const positionInputRef = useRef(null);

  useEffect(() => {
    if (!editingPosition) setPositionValue(profile.position || "");
  }, [profile.position, editingPosition]);

  useEffect(() => {
    if (editingPosition) positionInputRef.current?.focus();
  }, [editingPosition]);

  const handleSavePosition = async () => {
    const trimmed = positionValue.trim();
    if (!trimmed || trimmed === (profile.position || "")) {
      setEditingPosition(false);
      setPositionValue(profile.position || "");
      return;
    }
    setSavingPosition(true);
    setPositionError("");
    try {
      const { data } = await updateEmployeePosition(employeeId, trimmed);
      onProfileUpdate({ position: data.position });
      setEditingPosition(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Could not update position.";
      setPositionError(
        typeof msg === "string" ? msg : "Could not update position.",
      );
    } finally {
      setSavingPosition(false);
    }
  };

  const handlePositionKeyDown = (e) => {
    if (e.key === "Enter") handleSavePosition();
    if (e.key === "Escape") {
      setEditingPosition(false);
      setPositionValue(profile.position || "");
      setPositionError("");
    }
  };

  return (
    <div className={empStyles.wrap}>
      {locked && (
        <div className={empStyles.infoBanner}>
          <i className="ti ti-shield-lock" aria-hidden="true" />
          <span>
            {profile.firstName} is a Head of Department — only the employer can
            change these fields for a fellow HOD.
          </span>
        </div>
      )}

      {/* ── Employment type ── */}
      <div className={empStyles.section}>
        <h4 className={empStyles.sectionTitle}>Employment type</h4>
        <p className={empStyles.sectionDesc}>
          Determines how attendance is tracked for{" "}
          {profile.firstName || "this employee"}. Changes apply immediately.
        </p>

        {typeError && (
          <div className={empStyles.errorBanner} style={{ marginBottom: 12 }}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {typeError}
          </div>
        )}

        <div className={empStyles.typeGrid}>
          <button
            type="button"
            className={`${empStyles.typeCard} ${!isPartTime ? empStyles.typeCardActive : ""}`}
            onClick={() => handleTypeChange("FULL_TIME")}
            disabled={locked || savingType}
          >
            <div className={empStyles.typeIcon}>
              <i className="ti ti-briefcase" aria-hidden="true" />
            </div>
            <div className={empStyles.typeText}>
              <span className={empStyles.typeLabel}>Full-time</span>
              <span className={empStyles.typeDesc}>
                Follows the standard company-wide weekly schedule.
              </span>
            </div>
            {!isPartTime && (
              <i
                className={`ti ti-circle-check-filled ${empStyles.typeCheck}`}
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            className={`${empStyles.typeCard} ${isPartTime ? empStyles.typeCardActive : ""}`}
            onClick={() => handleTypeChange("PART_TIME")}
            disabled={locked || savingType}
          >
            <div className={empStyles.typeIcon}>
              <i className="ti ti-clock-hour-4" aria-hidden="true" />
            </div>
            <div className={empStyles.typeText}>
              <span className={empStyles.typeLabel}>Part-time</span>
              <span className={empStyles.typeDesc}>
                Uses a personalized schedule, set on the Schedule tab.
              </span>
            </div>
            {isPartTime && (
              <i
                className={`ti ti-circle-check-filled ${empStyles.typeCheck}`}
                aria-hidden="true"
              />
            )}
          </button>
        </div>
        {savingType && <span className={empStyles.savingTag}>Saving…</span>}
      </div>

      {/* ── Department — employer only ── */}
      {isEmployer && (
        <div className={empStyles.section}>
          <h4 className={empStyles.sectionTitle}>Department</h4>
          <p className={empStyles.sectionDesc}>
            Reassign {profile.firstName || "this employee"} to a different
            department, or unassign them. Applies immediately.
          </p>
          {deptLoading ? (
            <span className={empStyles.savingTag}>Loading departments…</span>
          ) : (
            <DepartmentCell
              employee={{
                id: employeeId,
                departmentId: profile.departmentId,
                department: profile.departmentName,
              }}
              departments={departments}
              onAssigned={handleDepartmentAssigned}
            />
          )}
        </div>
      )}

      {/* ── Salary — employer only ── */}
      {isEmployer && (
        <div className={empStyles.section}>
          <h4 className={empStyles.sectionTitle}>Salary</h4>
          <p className={empStyles.sectionDesc}>
            {profile.firstName || "This employee"}'s salary. Applies
            immediately, and they're notified right away whenever it's increased
            or decreased. Only visible to you — never to an HOD.
          </p>

          {salaryError && (
            <div className={empStyles.errorBanner} style={{ marginBottom: 12 }}>
              <i className="ti ti-alert-circle" aria-hidden="true" />
              {salaryError}
            </div>
          )}

          <div className={styles.fieldRow}>
            {editingSalary ? (
              <div className={styles.positionEditRow}>
                <input
                  ref={salaryInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.positionInput}
                  value={salaryValue}
                  onChange={(e) => setSalaryValue(e.target.value)}
                  onKeyDown={handleSalaryKeyDown}
                  placeholder="e.g. 250000.00"
                  disabled={savingSalary}
                />
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSaveSalary}
                  disabled={savingSalary}
                  aria-label="Save"
                >
                  <i
                    className={`ti ${savingSalary ? "ti-loader-2 ti-spin" : "ti-check"}`}
                  />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => {
                    setEditingSalary(false);
                    setSalaryValue(
                      profile.salary != null ? String(profile.salary) : "",
                    );
                    setSalaryError("");
                  }}
                  disabled={savingSalary}
                  aria-label="Cancel"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            ) : (
              <>
                <span className={styles.currentValue}>
                  {formatSalary(profile.salary) ?? "Not set"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {salarySavedMsg && (
                    <span className={styles.savedTag}>{salarySavedMsg}</span>
                  )}
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setEditingSalary(true)}
                    aria-label="Edit salary"
                    title="Edit salary"
                  >
                    <i className="ti ti-pencil" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Position ── */}
      <div className={empStyles.section}>
        <h4 className={empStyles.sectionTitle}>Position</h4>
        <p className={empStyles.sectionDesc}>
          {profile.firstName || "This employee"}'s job title. Applies
          immediately — no approval needed.
        </p>

        {positionError && (
          <div className={empStyles.errorBanner} style={{ marginBottom: 12 }}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {positionError}
          </div>
        )}

        <div className={styles.fieldRow}>
          {editingPosition ? (
            <div className={styles.positionEditRow}>
              <input
                ref={positionInputRef}
                type="text"
                className={styles.positionInput}
                value={positionValue}
                onChange={(e) => setPositionValue(e.target.value)}
                onKeyDown={handlePositionKeyDown}
                placeholder="Job title"
                disabled={savingPosition}
              />
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSavePosition}
                disabled={savingPosition}
                aria-label="Save"
              >
                <i
                  className={`ti ${savingPosition ? "ti-loader-2 ti-spin" : "ti-check"}`}
                />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => {
                  setEditingPosition(false);
                  setPositionValue(profile.position || "");
                  setPositionError("");
                }}
                disabled={savingPosition}
                aria-label="Cancel"
              >
                <i className="ti ti-x" />
              </button>
            </div>
          ) : (
            <>
              <span className={styles.currentValue}>
                {profile.position || "No title set"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {justSaved && <span className={styles.savedTag}>Saved</span>}
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setEditingPosition(true)}
                  disabled={locked}
                  title={
                    locked
                      ? "Only the employer can change this for a Head of Department"
                      : "Edit position"
                  }
                  aria-label="Edit position"
                >
                  <i className="ti ti-pencil" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
