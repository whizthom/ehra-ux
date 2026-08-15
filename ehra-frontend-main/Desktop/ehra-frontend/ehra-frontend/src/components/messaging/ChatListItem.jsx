import Avatar from "./Avatar";
import { formatRelativeListTime } from "../../utils/messagingFormat";
import styles from "./ChatList.module.css";

export default function ChatListItem({
  conversation,
  active,
  onClick,
  onLongAction,
}) {
  const isDirect = conversation.type === "DIRECT";
  const isAnnouncement = conversation.type === "ANNOUNCEMENT";
  const isGroup = conversation.type === "GROUP";
  const online = isDirect ? conversation.online : false;

  const preview = conversation.lastMessagePreview || "No messages yet";

  return (
    <div
      className={`${styles.row} ${active ? styles.active : ""} ${conversation.unreadCount > 0 ? styles.unread : ""}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongAction?.(e);
      }}
    >
      {isAnnouncement ? (
        <div className={styles.announcementIcon}>
          <i className="ti ti-speakerphone" />
        </div>
      ) : (
        <Avatar
          name={conversation.name}
          src={conversation.avatarUrl}
          showPresence={isDirect}
          online={online}
        />
      )}
      <div className={styles.rowBody}>
        <div className={styles.rowTop}>
          <span className={styles.rowName}>
            {conversation.pinned && (
              <i className="ti ti-pin" style={{ marginRight: 4 }} />
            )}
            {isGroup && (
              <i
                className="ti ti-users-group"
                style={{ marginRight: 4, fontSize: 13 }}
              />
            )}
            {conversation.name}
          </span>
          <span className={styles.rowTime}>
            {formatRelativeListTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className={styles.rowBottom}>
          <span className={styles.rowPreview}>
            {conversation.muted && (
              <i className="ti ti-bell-off" style={{ marginRight: 4 }} />
            )}
            {preview}
          </span>
          {conversation.unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
