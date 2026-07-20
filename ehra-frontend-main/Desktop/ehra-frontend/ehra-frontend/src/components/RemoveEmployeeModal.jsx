import styles from "./RemoveEmployeeModal.module.css";

/**
 * Shared "remove employee" (soft-delete) confirmation dialog.
 *
 * Used by both WorkforceTab.jsx and Dashboard.jsx so the warning shown to
 * the admin is always identical, no matter where "Remove" was clicked from.
 * Previously each page had its own copy of this JSX/CSS, which is exactly
 * how they drifted apart — keeping one component here means there's only
 * one place to update.
 *
 * Props:
 *   employee  — { firstName, lastName } of the employee being removed.
 *               The modal renders nothing if this is null/undefined.
 *   onCancel  — called when the admin backs out (overlay click or Cancel).
 *   onConfirm — called when the admin confirms the removal.
 *   loading   — true while the soft-delete request is in flight.
 */
export default function RemoveEmployeeModal({
  employee,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!employee) return null;

  const name = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.modalOverlay} onClick={() => !loading && onCancel()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <i
            className="ti ti-alert-triangle"
            style={{ fontSize: 28, color: "var(--warning-text)" }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>Remove employee?</h3>
        <p className={styles.modalBody}>
          <strong>{name}</strong> will be moved to trash and removed from all
          active lists immediately. They will be{" "}
          <strong>permanently deleted after 7 days</strong>, but you can restore
          them from the trash before then.
        </p>
        <div className={styles.modalActions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={styles.confirmDeleteBtn}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Removing…" : "Yes, move to trash"}
          </button>
        </div>
      </div>
    </div>
  );
}
