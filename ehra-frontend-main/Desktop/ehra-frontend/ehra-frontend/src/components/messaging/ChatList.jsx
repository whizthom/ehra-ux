import { useMemo, useState } from "react";
import ChatListItem from "./ChatListItem";
import SearchResultsPanel from "./SearchResultsPanel";
import { formatDayLabel } from "../../utils/messagingFormat";
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
  const isSearching = query.trim().length > 0;

  // While searching, SearchResultsPanel takes over entirely (see its
  // doc) — it's backed by the real /api/messaging/search endpoint, which
  // covers message TEXT and document filenames, not just conversation
  // names already loaded on screen the way a client-side filter here
  // ever could. No point also running a local name-only filter alongside
  // it; the backend's own conversation-name search covers that case too.
  const filtered = useMemo(() => {
    switch (tab) {
      case "group":
        return conversations.filter((c) => !c.archived && c.type === "GROUP");
      case "archived":
        return conversations.filter((c) => c.archived);
      case "all":
      default:
        return conversations.filter((c) => !c.archived);
    }
  }, [conversations, tab]);

  // Groups the list the same way an open conversation's own messages are
  // grouped (formatDayLabel — TODAY / YESTERDAY / weekday / date), keyed
  // off each conversation's lastMessageAt: a chat active today sits under
  // TODAY, and the next day — with no action needed from anyone — the
  // exact same conversation reads under YESTERDAY instead, since the
  // label is recomputed from the real clock every render, never stored.
  //
  // Pinned conversations get their own leading "PINNED" group instead of
  // being folded into whatever day they happen to fall on — otherwise a
  // pinned chat from three days ago would either break the day ordering
  // or need to be pinned AND recently active to stay at the top, which
  // defeats the point of pinning. `conversations` arrives already sorted
  // pinned-first-then-by-recency (see useConversations.js), so slicing by
  // `.pinned` here preserves that order in both halves without a resort.
  const { pinnedList, dateGroups } = useMemo(() => {
    const pinnedList = filtered.filter((c) => c.pinned);
    const rest = filtered.filter((c) => !c.pinned);
    const groups = [];
    let lastLabel = null;
    for (const c of rest) {
      const label = formatDayLabel(c.lastMessageAt);
      if (label !== lastLabel) {
        groups.push({ label, items: [] });
        lastLabel = label;
      }
      groups[groups.length - 1].items.push(c);
    }
    return { pinnedList, dateGroups: groups };
  }, [filtered]);

  const emptyMessage = () => {
    switch (tab) {
      case "group":
        return "No groups yet — start one below.";
      case "archived":
        return "No archived chats.";
      default:
        return "No conversations yet.";
    }
  };

  const renderRow = (c) => (
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
  );

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

      {tab === "group" && !isSearching && (
        <button className={styles.newGroupBtn} onClick={onNewGroup}>
          <span className={styles.newGroupIcon}>
            <i className="ti ti-users-group" />
          </span>
          New group
        </button>
      )}

      {isSearching ? (
        <SearchResultsPanel
          query={query.trim()}
          onSelectConversation={onSelect}
        />
      ) : (
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
            <>
              {pinnedList.length > 0 && (
                <>
                  <div className={styles.dateGroupHeader}>PINNED</div>
                  {pinnedList.map(renderRow)}
                </>
              )}
              {dateGroups.map((group) => (
                <div key={group.label}>
                  <div className={styles.dateGroupHeader}>{group.label}</div>
                  {group.items.map(renderRow)}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
