import styles from "./LogoutConfirmModal.module.css";

/**
 * Shared "log out?" confirmation dialog.
 *
 * Used by the mobile bottom-nav logout button on Dashboard.jsx,
 * EmployeeDashboard.jsx, ScanAttendance.jsx, and MyAccountsPage.jsx so the
 * confirmation looks and behaves identically everywhere it can be triggered
 * from, the same way RemoveEmployeeModal is shared for the "remove
 * employee" action.
 *
 * Props:
 *   open      — whether the dialog is visible.
 *   onCancel  — called when the person backs out (overlay click or Cancel).
 *   onConfirm — called when the person confirms they want to log out.
 *   loading   — true while the logout request is in flight.
 */
export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={() => !loading && onCancel()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <i
            className="ti ti-logout"
            style={{ fontSize: 26, color: "var(--warning-text)" }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>Log out?</h3>
        <p className={styles.modalBody}>
          You'll need to sign back in to access your account.
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
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Logging out…" : "Yes, log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
