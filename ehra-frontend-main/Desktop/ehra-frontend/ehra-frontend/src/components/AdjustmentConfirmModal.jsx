import styles from "./LogoutConfirmModal.module.css";

/**
 * "Save this stock adjustment?" confirmation dialog.
 *
 * Deliberately shares LogoutConfirmModal's stylesheet (same as
 * DisconnectConfirmModal) so it looks and behaves identically to the
 * log out confirmation - same glassy card, icon tile and two-button
 * layout - just with the copy for the inventory adjustment.
 *
 * Props:
 *   open         - whether the dialog is visible.
 *   productName  - product the adjustment applies to.
 *   movementLabel- human label of the movement type (e.g. "Damaged").
 *   quantity     - quantity being recorded.
 *   note         - optional reason/reference.
 *   error        - optional error message from a failed save.
 *   onCancel     - called when the person backs out (overlay click or Cancel).
 *   onConfirm    - called when the person confirms the adjustment.
 *   loading      - true while the save request is in flight.
 */
export default function AdjustmentConfirmModal({
  open,
  productName,
  movementLabel,
  quantity,
  note,
  error,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!open) return null;

  const qty = Number(quantity);
  const units = `${quantity} unit${qty === 1 ? "" : "s"}`;

  return (
    <div className={styles.modalOverlay} onClick={() => !loading && onCancel()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <i
            className="ti ti-adjustments"
            style={{ fontSize: 26 }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>Save adjustment?</h3>
        <p className={styles.modalBody}>
          Record <strong>{movementLabel}</strong> of <strong>{units}</strong>{" "}
          for <strong>{productName || "this product"}</strong>. This will be
          saved as a stock movement and change the stock level.
          {note ? <> Note: {note}</> : null}
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
            {loading ? "Saving…" : "Yes, save adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
