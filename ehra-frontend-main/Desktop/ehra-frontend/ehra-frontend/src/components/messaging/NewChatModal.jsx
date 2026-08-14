import styles from "./NewChatModal.module.css";
export default function NewChatModal({ onClose, onCreate }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>New chat</h3>
        <button
          onClick={() => {
            onCreate({ type: "DIRECT" });
          }}
        >
          Create
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
