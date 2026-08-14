import { useState } from "react";
import ReactionPicker from "./ReactionPicker";
import MessageContextMenu from "./MessageContextMenu";
import VoicePlayer from "./VoicePlayer";
import SystemMessage from "./SystemMessage";
import {
  formatTime,
  splitLinks,
  formatFileSize,
} from "../../utils/messagingFormat";
import styles from "./MessageBubble.module.css";

function LinkifiedText({ text }) {
  const parts = splitLinks(text);
  return (
    <>
      {parts.map((p, i) =>
        p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function StatusTicks({ status }) {
  if (status === "SENDING")
    return <i className={`ti ti-clock ${styles.tickPending}`} />;
  if (status === "FAILED")
    return <i className={`ti ti-alert-circle ${styles.tickFailed}`} />;
  if (status === "READ")
    return <i className={`ti ti-checks ${styles.tickRead}`} />;
  if (status === "DELIVERED")
    return <i className={`ti ti-checks ${styles.tickSent}`} />;
  if (status === "SENT")
    return <i className={`ti ti-check ${styles.tickSent}`} />;
  return null;
}

export default function MessageBubble({
  message,
  isOwn,
  isGroup,
  canDeleteForEveryone,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onUnreact,
  onScrollToReply,
  onRetry,
  myIdentityId,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (message.messageType === "SYSTEM") {
    return <SystemMessage message={message} />;
  }

  if (message.deleted) {
    return (
      <div className={`${styles.row} ${isOwn ? styles.own : styles.other}`}>
        <div className={`${styles.bubble} ${styles.tombstone}`}>
          <i className="ti ti-ban" /> This message was deleted
        </div>
      </div>
    );
  }

  const myReaction = message.reactions?.find((r) => r.reactedByMe)?.reaction;

  const renderContent = () => {
    switch (message.messageType) {
      case "IMAGE":
        return (
          <div>
            <img
              src={message.metadata?.url}
              alt=""
              className={styles.imageContent}
              onClick={() => window.open(message.metadata?.url, "_blank")}
            />
            {message.body && (
              <div className={styles.caption}>
                <LinkifiedText text={message.body} />
              </div>
            )}
          </div>
        );
      case "DOCUMENT":
        return (
          <a
            className={styles.documentRow}
            href={message.metadata?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="ti ti-file-text" style={{ fontSize: 26 }} />
            <div className={styles.documentInfo}>
              <span className={styles.documentName}>
                {message.metadata?.fileName || "Document"}
              </span>
              <span className={styles.documentMeta}>
                {formatFileSize(message.metadata?.fileSizeBytes)}
              </span>
            </div>
            <i className="ti ti-download" />
          </a>
        );
      case "VOICE":
        return (
          <VoicePlayer
            url={message.metadata?.url}
            durationSeconds={message.metadata?.durationSeconds}
          />
        );
      case "LOCATION":
        return (
          <a
            className={styles.locationRow}
            href={`https://www.google.com/maps?q=${message.metadata?.lat},${message.metadata?.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="ti ti-map-pin" style={{ fontSize: 26 }} />
            <span>{message.metadata?.label || "Shared location"}</span>
          </a>
        );
      case "TEXT":
      default:
        return (
          <div className={styles.textContent}>
            <LinkifiedText text={message.body} />
          </div>
        );
    }
  };

  return (
    <div className={`${styles.row} ${isOwn ? styles.own : styles.other}`}>
      <div className={styles.bubbleWrap}>
        {isGroup && !isOwn && (
          <div className={styles.senderName}>{message.senderName}</div>
        )}

        <div
          className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`}
          onDoubleClick={() => setShowReactionPicker(true)}
        >
          {message.replyTo && (
            <button
              className={styles.replyPreview}
              onClick={() => onScrollToReply(message.replyTo.messageId)}
            >
              <span className={styles.replyName}>
                {message.replyTo.senderName}
              </span>
              <span className={styles.replySnippet}>
                {message.replyTo.snippet}
              </span>
            </button>
          )}

          {renderContent()}

          <div className={styles.metaRow}>
            {message.edited && <span className={styles.editedTag}>edited</span>}
            <span className={styles.time}>{formatTime(message.createdAt)}</span>
            {isOwn && <StatusTicks status={message.status} />}
          </div>

          {message.status === "FAILED" && (
            <button
              className={styles.retryBtn}
              onClick={() => onRetry(message)}
            >
              <i className="ti ti-refresh" /> Failed — tap to retry
            </button>
          )}

          <button
            className={styles.hoverActions}
            onClick={() => setShowMenu((v) => !v)}
          >
            <i className="ti ti-dots" />
          </button>
          <button
            className={styles.hoverReact}
            onClick={() => setShowReactionPicker((v) => !v)}
          >
            <i className="ti ti-mood-smile" />
          </button>

          {showReactionPicker && (
            <div className={styles.reactionPickerAnchor}>
              <ReactionPicker
                onPick={(emoji) => {
                  if (myReaction === emoji) onUnreact(message.id);
                  else onReact(message.id, emoji);
                  setShowReactionPicker(false);
                }}
                onClose={() => setShowReactionPicker(false)}
              />
            </div>
          )}

          {showMenu && (
            <div className={styles.menuAnchor}>
              <MessageContextMenu
                isOwn={isOwn}
                canDeleteForEveryone={canDeleteForEveryone}
                onReply={() => onReply(message)}
                onCopy={() =>
                  navigator.clipboard?.writeText(message.body || "")
                }
                onEdit={() => onEdit(message)}
                onDeleteForMe={() => onDeleteForMe(message.id)}
                onDeleteForEveryone={() => onDeleteForEveryone(message.id)}
                onClose={() => setShowMenu(false)}
              />
            </div>
          )}
        </div>

        {message.reactions?.length > 0 && (
          <div className={styles.reactionsRow}>
            {message.reactions.map((r) => (
              <button
                key={r.reaction}
                className={`${styles.reactionChip} ${r.reactedByMe ? styles.reactionChipMine : ""}`}
                onClick={() =>
                  r.reactedByMe
                    ? onUnreact(message.id)
                    : onReact(message.id, r.reaction)
                }
              >
                {r.reaction} {r.count > 1 ? r.count : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
