import styles from "./LogoutConfirmModal.module.css";

/**
 * "Archive this product?" confirmation dialog.
 *
 * Shares LogoutConfirmModal's stylesheet (like DisconnectConfirmModal and
 * AdjustmentConfirmModal) so it looks and behaves identically to the log
 * out confirmation - same glassy card, icon tile and two-button layout.
 *
 * Props:
 *   open        - whether the dialog is visible.
 *   productName - name of the product being archived.
 *   error       - optional error message from a failed archive.
 *   onCancel    - called when the person backs out (overlay click or Cancel).
 *   onConfirm   - called when the person confirms the archive.
 *   loading     - true while the archive request is in flight.
 */
export default function ArchiveConfirmModal({
  open,
  productName,
  error,
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
            className="ti ti-archive"
            style={{ fontSize: 26, color: "var(--danger-text)" }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>
          Archive {productName || "this product"}?
        </h3>
        <p className={styles.modalBody}>
          It will no longer appear as an active product or be sold from the POS
          and store. You can view it under Archived and restore it any time.
        </p>
        {error && (
          <p
            className={styles.modalBody}
            role="alert"
            style={{ color: "var(--danger-text)" }}
          >
            {error}
          </p>
        )}
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
            {loading ? "Archiving…" : "Yes, archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
