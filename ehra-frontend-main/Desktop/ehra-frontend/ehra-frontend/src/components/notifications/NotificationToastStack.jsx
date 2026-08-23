import Avatar from "../messaging/Avatar";
import useMentionToasts from "../../hooks/useMentionToasts";
import useNewMessageToasts from "../../hooks/useNewMessageToasts";
import styles from "./MentionToastStack.module.css";

// The single toast stack for BOTH real-time messaging notifications —
// "you were @mentioned" (useMentionToasts) and "you have a new message"
// (useNewMessageToasts). Deliberately ONE component rendering ONE
// fixed-position stack rather than two separate ones: each used its own
// independent `position: fixed` container at the same screen
// coordinates, so mounting both at once made them overlap on top of each
// other instead of stacking — merging the two toast lists here (sorted
// oldest-first, same as they'd naturally arrive) is what actually fixes
// that, not just moving one of them to a different corner.
export default function NotificationToastStack({
  onNavigate,
  activeConversationId,
}) {
  const { toasts: mentionToasts, dismiss: dismissMention } = useMentionToasts();
  const { toasts: messageToasts, dismiss: dismissMessage } =
    useNewMessageToasts(activeConversationId);

  const combined = [
    ...mentionToasts.map((t) => ({ ...t, kind: "mention" })),
    ...messageToasts.map((t) => ({ ...t, kind: "message" })),
  ].sort((a, b) => (a.id > b.id ? 1 : -1));

  if (combined.length === 0) return null;

  const dismiss = (t) =>
    t.kind === "mention" ? dismissMention(t.id) : dismissMessage(t.id);

  return (
    <div className={styles.stack}>
      {combined.map((t) => (
        <div
          key={t.id}
          className={styles.toast}
          onClick={() => {
            onNavigate(t.conversationId, t.messageId);
            dismiss(t);
          }}
        >
          {t.kind === "mention" ? (
            <div className={styles.iconWrap}>
              <i className="ti ti-at" />
            </div>
          ) : (
            <Avatar
              name={t.conversationName}
              src={t.senderAvatarUrl}
              size={34}
            />
          )}
          <div className={styles.body}>
            <span className={styles.title}>
              {t.kind === "mention"
                ? `${t.senderName} mentioned you`
                : t.isGroup
                  ? `${t.senderName} in ${t.conversationName}`
                  : t.senderName}
            </span>
            {t.kind === "mention" && (
              <span className={styles.meta}>{t.conversationName}</span>
            )}
            {t.snippet && <span className={styles.snippet}>{t.snippet}</span>}
          </div>
          <button
            className={styles.closeBtn}
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t);
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
