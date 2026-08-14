import styles from "./MessageContextMenu.module.css";

export default function MessageContextMenu({
  isOwn,
  onReply,
  onCopy,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}) {
  return (
    <div className={styles.menu}>
      <button onClick={onReply}>Reply</button>
      <button onClick={onCopy}>Copy</button>
      {isOwn && <button onClick={onEdit}>Edit</button>}
      <button onClick={onDeleteForMe}>Delete for me</button>
      {isOwn && (
        <button onClick={onDeleteForEveryone}>Delete for everyone</button>
      )}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
