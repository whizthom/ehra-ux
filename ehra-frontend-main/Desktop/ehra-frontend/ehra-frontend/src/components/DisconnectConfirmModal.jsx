import styles from "./LogoutConfirmModal.module.css";

/**
 * "Disconnect from this business?" confirmation dialog.
 *
 * Deliberately shares LogoutConfirmModal's stylesheet so it looks and
 * behaves identically to the sign-out confirmation - same glassy card,
 * same icon tile, same two-button layout - just swapping the icon and
 * copy for the disconnect action. Used from the customer dashboard's
 * Discover tab (and anywhere else a customer can disconnect from a
 * business) so the confirmation is consistent everywhere it appears.
 *
 * Props:
 *   open         - whether the dialog is visible.
 *   businessName - name of the business being disconnected from.
 *   onCancel     - called when the person backs out (overlay click or Cancel).
 *   onConfirm    - called when the person confirms they want to disconnect.
 *   loading      - true while the disconnect request is in flight.
 */
export default function DisconnectConfirmModal({
  open,
  businessName,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!open) return null;

  const name = businessName || "this business";

  return (
    <div className={styles.modalOverlay} onClick={() => !loading && onCancel()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <i
            className="ti ti-plug-connected-x"
            style={{ fontSize: 26, color: "var(--danger-text)" }}
            aria-hidden="true"
          />
        </div>
        <h3 className={styles.modalTitle}>Disconnect from {name}?</h3>
        <p className={styles.modalBody}>
          You'll stop seeing updates from them and will need to reconnect to
          order or message them again. Your past orders and receipts stay in
          your Ehral account.
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
            {loading ? "Disconnecting…" : "Yes, disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}
