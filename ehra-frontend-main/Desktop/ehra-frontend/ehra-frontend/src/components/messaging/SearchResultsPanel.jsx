import useMessageSearch from "../../hooks/useMessageSearch";
import styles from "./SearchResultsPanel.module.css";

// Replaces the normal (tab-filtered, date-grouped) conversation list
// while a search query is active — a message-text match isn't really "a
// conversation in a date group", it's a specific hit that should jump
// straight to that conversation (and, where possible, that exact
// message). See useMessageSearch's doc for why this needs its own
// backend-driven results list rather than reusing ChatList's client-side
// name filter.
export default function SearchResultsPanel({ query, onSelectConversation }) {
  const { results, loading } = useMessageSearch(query);

  if (loading && results.length === 0) {
    return <div className={styles.state}>Searching…</div>;
  }

  if (results.length === 0) {
    return <div className={styles.state}>No results for "{query}"</div>;
  }

  const conversationHits = results.filter((r) => r.kind === "CONVERSATION");
  const messageHits = results.filter((r) => r.kind === "MESSAGE");

  return (
    <div className={styles.panel}>
      {conversationHits.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Chats</div>
          {conversationHits.map((r) => (
            <button
              key={`c-${r.conversationId}`}
              className={styles.row}
              onClick={() => onSelectConversation(r.conversationId)}
            >
              <i className="ti ti-message-circle-2" />
              <span className={styles.rowName}>{r.conversationName}</span>
            </button>
          ))}
        </>
      )}

      {messageHits.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Messages</div>
          {messageHits.map((r) => (
            <button
              key={`m-${r.messageId}`}
              className={styles.row}
              onClick={() =>
                onSelectConversation(r.conversationId, r.messageId)
              }
            >
              <i className="ti ti-search" />
              <span className={styles.messageHit}>
                <span className={styles.rowName}>{r.conversationName}</span>
                <span className={styles.snippet}>{r.snippet}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
