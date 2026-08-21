import useMentionToasts from "../../hooks/useMentionToasts";
import styles from "./MentionToastStack.module.css";

// Rendered once, near the top of the app shell (Dashboard.jsx /
// EmployeeDashboard.jsx) — see useMentionToasts.js's doc for why it
// can't just live inside MessagingHub. Clicking a toast hands the
// (conversationId, messageId) up to onNavigate, which the dashboard uses
// to both switch to the Messages tab AND deep-link MessagingHub straight
// to that exact message (see ChatWindow.jsx's highlightMessageId
// handling, the same mechanism search results use).
export default function MentionToastStack({ onNavigate }) {
  const { toasts, dismiss } = useMentionToasts();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={styles.toast}
          onClick={() => {
            onNavigate(t.conversationId, t.messageId);
            dismiss(t.id);
          }}
        >
          <div className={styles.iconWrap}>
            <i className="ti ti-at" />
          </div>
          <div className={styles.body}>
            <span className={styles.title}>{t.senderName} mentioned you</span>
            <span className={styles.meta}>{t.conversationName}</span>
            {t.snippet && <span className={styles.snippet}>{t.snippet}</span>}
          </div>
          <button
            className={styles.closeBtn}
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
