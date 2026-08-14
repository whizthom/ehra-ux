import styles from "./ReactionPicker.module.css";
import menuStyles from "./MessageContextMenu.module.css";

export default function MessageContextMenu({
  isOwn,
  canDeleteForEveryone,
  onReply,
  onCopy,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}) {
  return (
    <div className={menuStyles.menu} onMouseLeave={onClose}>
      <button
        onClick={() => {
          onReply();
          onClose();
        }}
      >
        <i className="ti ti-arrow-back-up" /> Reply
      </button>
      <button
        onClick={() => {
          onCopy();
          onClose();
        }}
      >
        <i className="ti ti-copy" /> Copy
      </button>
      {isOwn && (
        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          <i className="ti ti-edit" /> Edit
        </button>
      )}
      <button
        onClick={() => {
          onDeleteForMe();
          onClose();
        }}
      >
        <i className="ti ti-trash" /> Delete for me
      </button>
      {canDeleteForEveryone && (
        <button
          className={menuStyles.danger}
          onClick={() => {
            onDeleteForEveryone();
            onClose();
          }}
        >
          <i className="ti ti-trash-x" /> Delete for everyone
        </button>
      )}
    </div>
  );
}
