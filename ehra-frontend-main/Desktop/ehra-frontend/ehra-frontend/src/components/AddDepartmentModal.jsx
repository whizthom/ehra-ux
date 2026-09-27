import { useState } from "react";
import { createDepartment } from "../api/departmentApi";
import styles from "./AddDepartmentModal.module.css";

export default function AddDepartmentModal({
  open,
  onClose,
  onCreated,
  employees,
}) {
  const [name, setName] = useState("");
  const [hodId, setHodId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await createDepartment({
        name: name.trim(),
        hodId: hodId ? Number(hodId) : null,
      });
      onCreated(data);
      setName("");
      setHodId("");
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        "Failed to create department.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Add department</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.field}>
            <label>Department name *</label>
            <input
              type="text"
              placeholder="e.g. Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label>
              Head of department{" "}
              <span className={styles.optional}>(optional)</span>
            </label>
            <select value={hodId} onChange={(e) => setHodId(e.target.value)}>
              <option value="">No HOD assigned</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {[emp.firstName, emp.lastName].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.createBtn}
            onClick={handleSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? "Creating…" : "Create department"}
          </button>
        </div>
      </div>
    </div>
  );
}
