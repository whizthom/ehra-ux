import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import MessageComposer from "./MessageComposer";
import GroupInfoModal from "./GroupInfoModal";
import useConversationMessages from "../../hooks/useConversationMessages";
import useTypingBroadcast from "../../hooks/useTypingBroadcast";
import { formatDayLabel } from "../../utils/messagingFormat";
import styles from "./ChatWindow.module.css";

export default function ChatWindow({
  conversation,
  myIdentityId,
  onBack,
  onConversationChanged,
  highlightMessageId,
}) {
  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    loadOlder,
    typingUsers,
    send,
    retry,
    edit,
    remove,
    react,
    unreact,
  } = useConversationMessages(conversation.id, myIdentityId);
  const { onKeystroke, stop: stopTyping } = useTypingBroadcast(conversation.id);

  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);

  const isGroup = conversation.type === "GROUP";
  const isAnnouncement = conversation.type === "ANNOUNCEMENT";
  // Both GROUP and ANNOUNCEMENT have more than one possible sender, so
  // bubbles need the sender-name label and the header needs a member
  // count instead of a single person's presence — GroupInfoModal
  // (membership management) stays GROUP-only, since "leave"/"remove
  // member" don't really make sense for a company-wide channel everyone's
  // auto-enrolled in.
  const isMultiParty = isGroup || isAnnouncement;
  const other = !isMultiParty ? conversation.participants?.[0] : null;

  const groupMembers = isMultiParty ? conversation.participants : undefined;

  const myParticipant = conversation.participants?.find(
    (p) => p.identityId === myIdentityId,
  );
  // Mirrors the backend's actual rule (MsgMessagingServiceImpl#sendMessage
  // checks the caller's MsgConversationMember role, ADMIN-only for
  // ANNOUNCEMENT) via the same signal already available client-side: an
  // Employer/HOD's org-level roleLabel. This is a UI convenience, not the
  // enforcement — the server rejects the POST regardless of what this
  // computes, so getting it wrong here can only ever over-hide the
  // composer, never let someone post who isn't allowed to.
  const canPostHere =
    !isAnnouncement ||
    myParticipant?.roleLabel === "Employer" ||
    Boolean(myParticipant?.roleLabel?.startsWith("HOD"));

  // Auto-scroll to bottom on first load and on new messages, but only if
  // the person was already near the bottom — never yank them away from
  // history they scrolled up to read (section 28's "avoid unnecessary
  // re-renders/jumps").
  useEffect(() => {
    if (loading) return;
    if (isNearBottomRef.current) {
      bottomAnchorRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, loading]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && hasMore && !loadingOlder) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadOlder().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop =
              scrollRef.current.scrollHeight - prevScrollHeightRef.current;
          }
        });
      });
    }
  }, [hasMore, loadingOlder, loadOlder]);

  const grouped = useMemo(() => {
    const groups = [];
    let lastLabel = null;
    for (const m of messages) {
      const label = formatDayLabel(m.createdAt);
      if (label !== lastLabel) {
        groups.push({ type: "date", label, key: `d-${m.id}` });
        lastLabel = label;
      }
      groups.push({ type: "message", message: m });
    }
    return groups;
  }, [messages]);

  const scrollToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add(styles.highlight);
      setTimeout(() => el.classList.remove(styles.highlight), 1200);
    }
  };

  // A search result for a MESSAGE hit (see SearchResultsPanel.jsx) opens
  // this conversation with a specific target message id — which is very
  // often NOT in the most-recent page useConversationMessages loads by
  // default. Rather than silently failing to highlight anything older
  // than the first page, this keeps calling loadOlder() (the same
  // cursor-pagination the person would use by scrolling up manually)
  // until the target message actually shows up in `messages`, or the
  // conversation genuinely runs out of history (hasMore false) — turning
  // a search hit into a real deep link to any message, not just recent
  // ones.
  useEffect(() => {
    if (!highlightMessageId || loading) return;
    if (messages.some((m) => m.id === highlightMessageId)) {
      requestAnimationFrame(() => scrollToMessage(highlightMessageId));
      return;
    }
    if (hasMore && !loadingOlder) {
      loadOlder();
    }
  }, [highlightMessageId, messages, loading, hasMore, loadingOlder, loadOlder]);

  const handleSend = async (payload) => {
    setReplyTo(null);
    await send(payload);
  };

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <i className="ti ti-arrow-left" />
          </button>
        )}
        <button
          className={styles.headerIdentity}
          onClick={() => isGroup && setShowGroupInfo(true)}
          disabled={!isGroup}
        >
          {isAnnouncement ? (
            <div className={styles.announcementAvatar}>
              <i className="ti ti-speakerphone" />
            </div>
          ) : (
            <Avatar
              name={conversation.name}
              src={conversation.avatarUrl}
              showPresence={!isMultiParty}
              online={conversation.online}
            />
          )}
          <div className={styles.headerText}>
            <span className={styles.headerNameRow}>
              <span className={styles.headerName}>{conversation.name}</span>
              {!isMultiParty && other?.roleLabel && (
                <RoleBadge roleLabel={other.roleLabel} size="sm" />
              )}
            </span>
            <span className={styles.headerStatus}>
              {typingUsers.length > 0
                ? "typing…"
                : isMultiParty
                  ? `${conversation.participants?.length || 0} members`
                  : conversation.online
                    ? "Online"
                    : other?.lastSeenAt
                      ? `Last seen ${new Date(other.lastSeenAt).toLocaleString()}`
                      : "Offline"}
            </span>
          </div>
        </button>
        {isGroup && (
          <button
            className={styles.headerAction}
            onClick={() => setShowGroupInfo(true)}
          >
            <i className="ti ti-info-circle" />
          </button>
        )}
      </div>

      <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
        {loadingOlder && (
          <div className={styles.loadingOlder}>Loading earlier messages…</div>
        )}
        {loading ? (
          <div className={styles.centerState}>Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className={styles.centerState}>
            <div className={styles.emptyIcon}>
              <i className="ti ti-message-circle-2" />
            </div>
            <h3>Start the conversation</h3>
            <p>Send a message to get started.</p>
          </div>
        ) : (
          grouped.map((item) =>
            item.type === "date" ? (
              <DateSeparator key={item.key} label={item.label} />
            ) : (
              <div id={`msg-${item.message.id}`} key={item.message.id}>
                <MessageBubble
                  message={item.message}
                  isOwn={item.message.senderIdentityId === myIdentityId}
                  isGroup={isMultiParty}
                  canDeleteForEveryone={
                    item.message.senderIdentityId === myIdentityId ||
                    conversation.participants?.find(
                      (p) => p.identityId === myIdentityId,
                    )?.roleLabel === "Employer"
                  }
                  onReply={setReplyTo}
                  onEdit={setEditingMessage}
                  onDeleteForMe={(id) => remove(id, false)}
                  onDeleteForEveryone={(id) => remove(id, true)}
                  onReact={react}
                  onUnreact={unreact}
                  onScrollToReply={scrollToMessage}
                  onRetry={retry}
                  myIdentityId={myIdentityId}
                />
              </div>
            ),
          )
        )}
        <div ref={bottomAnchorRef} />
      </div>

      <TypingIndicator users={typingUsers} />

      {canPostHere ? (
        <MessageComposer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={handleSend}
          onTypingKeystroke={onKeystroke}
          onStopTyping={stopTyping}
          groupMembers={groupMembers}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={async (id, body) => {
            await edit(id, body);
            setEditingMessage(null);
          }}
        />
      ) : (
        <div className={styles.readOnlyBar}>
          <i className="ti ti-lock" />
          Only Employers and HODs can post to Announcements
        </div>
      )}

      {showGroupInfo && (
        <GroupInfoModal
          conversation={conversation}
          myIdentityId={myIdentityId}
          onClose={() => setShowGroupInfo(false)}
          onChanged={onConversationChanged}
        />
      )}
    </div>
  );
}
