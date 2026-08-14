import styles from "./GroupInfoModal.module.css";

export default function GroupInfoModal({ open, onClose, group }) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{group?.name || "Group"}</h3>
        <p>{group?.description}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
