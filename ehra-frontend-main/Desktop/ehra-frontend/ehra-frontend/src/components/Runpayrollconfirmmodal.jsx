import styles from "./RunPayrollConfirmModal.module.css";

/**
 * "Run payroll now?" confirmation dialog.
 *
 * Same look and behaviour as LogoutConfirmModal (see that file) - shown
 * before PenaltyTab.jsx's "Run payroll now" button actually finalizes the
 * current pay period, since that action can't be undone and shouldn't
 * fire on a single accidental click.
 *
 * Props:
 *   open      - whether the dialog is visible.
 *   onCancel  - called when the person backs out (overlay click or Cancel).
 *   onConfirm - called when the person confirms they want to run payroll.
 *   loading   - true while the finalize request is in flight.
 */
export default function RunPayrollConfirmModal({
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
            className="ti ti-cash"
            style={{ fontSize: 26, color: "var(--danger-text)" }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>Run payroll now?</h3>
        <p className={styles.modalBody}>
          This finalizes the current pay period immediately, instead of waiting
          for the scheduled payout day. Once finalized, it can't be undone.
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
            {loading ? "Running…" : "Yes, run payroll"}
          </button>
        </div>
      </div>
    </div>
  );
}
