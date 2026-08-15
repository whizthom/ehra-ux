import { useMemo, useState } from "react";
import ChatListItem from "./ChatListItem";
import styles from "./ChatList.module.css";

// The tab bar itself (All / Group / Announcement / Archived) now lives one
// level up, in MessagingHub — "Announcement" isn't a filter over
// conversations at all, it swaps the whole pane for Ehral's existing
// Announcements feature (see MessagingHub.jsx's doc). This component only
// ever renders for the "all" / "group" / "archived" tabs; `tab` is a prop,
// not local state.
export default function ChatList({
  tab,
  conversations,
  loading,
  error,
  onRetry,
  activeId,
  onSelect,
  onNewGroup,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState(null);

  const filtered = useMemo(() => {
    let base;
    switch (tab) {
      case "group":
        base = conversations.filter((c) => !c.archived && c.type === "GROUP");
        break;
      case "archived":
        base = conversations.filter((c) => c.archived);
        break;
      case "all":
      default:
        base = conversations.filter((c) => !c.archived);
        break;
    }
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [conversations, query, tab]);

  const emptyMessage = () => {
    if (query) return "No conversations match your search.";
    switch (tab) {
      case "group":
        return "No groups yet — start one below.";
      case "archived":
        return "No archived chats.";
      default:
        return "No conversations yet.";
    }
  };

  return (
    <div className={styles.listPanel}>
      <div className={styles.searchWrap}>
        <i className="ti ti-search" />
        <input
          className={styles.searchInput}
          placeholder="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {tab === "group" && (
        <button className={styles.newGroupBtn} onClick={onNewGroup}>
          <span className={styles.newGroupIcon}>
            <i className="ti ti-users-group" />
          </span>
          New group
        </button>
      )}

      <div className={styles.list}>
        {error && conversations.length === 0 ? (
          <div className={styles.errorState}>
            <i className="ti ti-alert-triangle" />
            <p>
              {error?.response?.status === 403 ||
              error?.response?.status === 401
                ? "Couldn't load conversations — your session may need refreshing."
                : "Couldn't load conversations. Check your connection and try again."}
            </p>
            <button onClick={onRetry}>Retry</button>
          </div>
        ) : loading ? (
          <div className={styles.loadingState}>Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>{emptyMessage()}</div>
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
