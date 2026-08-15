import { useMemo, useState } from "react";
import ChatListItem from "./ChatListItem";
import styles from "./ChatList.module.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "group", label: "Group" },
  { key: "announcement", label: "Announcement" },
  { key: "archived", label: "Archived" },
];

export default function ChatList({
  conversations,
  loading,
  activeId,
  onSelect,
  onNewGroup,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    let base;
    switch (tab) {
      case "group":
        base = conversations.filter((c) => !c.archived && c.type === "GROUP");
        break;
      case "announcement":
        base = conversations.filter(
          (c) => !c.archived && c.type === "ANNOUNCEMENT",
        );
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
      case "announcement":
        return "No announcements yet.";
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

      <div className={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
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
        {loading ? (
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
