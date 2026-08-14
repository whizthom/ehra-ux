import { useMemo, useState } from "react";
import ChatListItem from "./ChatListItem";
import styles from "./ChatList.module.css";

export default function ChatList({
  conversations,
  loading,
  activeId,
  onSelect,
  onNewChat,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const base = conversations.filter(
      (c) => Boolean(c.archived) === showArchived,
    );
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [conversations, query, showArchived]);

  return (
    <div className={styles.listPanel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Chats</h2>
        <button
          className={styles.newChatBtn}
          onClick={onNewChat}
          title="New conversation"
        >
          <i className="ti ti-edit" />
        </button>
      </div>

      <div className={styles.searchWrap}>
        <i className="ti ti-search" />
        <input
          className={styles.searchInput}
          placeholder="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.archiveToggleRow}>
        <button
          className={`${styles.archiveToggle} ${!showArchived ? styles.archiveToggleActive : ""}`}
          onClick={() => setShowArchived(false)}
        >
          All
        </button>
        <button
          className={`${styles.archiveToggle} ${showArchived ? styles.archiveToggleActive : ""}`}
          onClick={() => setShowArchived(true)}
        >
          Archived
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loadingState}>Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {query
              ? "No conversations match your search."
              : showArchived
                ? "No archived chats."
                : "No conversations yet."}
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className={styles.rowWrap}>
              <ChatListItem
                conversation={c}
                active={c.id === activeId}
                onClick={() => onSelect(c.id)}
                onLongAction={() => setMenuFor(menuFor === c.id ? null : c.id)}
              />
              {menuFor === c.id && (
                <div
                  className={styles.contextMenu}
                  onMouseLeave={() => setMenuFor(null)}
                >
                  <button
                    onClick={() => {
                      onTogglePin(c);
                      setMenuFor(null);
                    }}
                  >
                    {c.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => {
                      onToggleMute(c);
                      setMenuFor(null);
                    }}
                  >
                    {c.muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={() => {
                      onToggleArchive(c);
                      setMenuFor(null);
                    }}
                  >
                    {c.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
