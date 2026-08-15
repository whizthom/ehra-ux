import { useEffect, useState } from "react";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import NewChatModal from "./NewChatModal";
import MessagesTab from "../MessagesTab";
import EmployeeInbox from "../EmployeeMessagesInbox";
import { useAuth } from "../../context/AuthContext";
import useConversations from "../../hooks/useConversations";
import useMessagingConnection from "../../hooks/useMessagingConnection";
import { createConversation, updateConversationState } from "../../api/messagingApi";
import styles from "./MessagingHub.module.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "group", label: "Group" },
  { key: "announcement", label: "Announcement" },
  { key: "archived", label: "Archived" },
];

// Drop-in replacement for the old <MessagesHub /> (SSE-based, text-only,
// employee<->manager-only). Same two props the dashboards already pass
// (`viewer`, `onThreadOpenChange`) so wiring it in was a one-line import
// swap in Dashboard.jsx / EmployeeDashboard.jsx — see those files. Every
// requirement from section 3 onward (groups, attachments, reactions,
// presence, etc.) lives inside ChatList/ChatWindow and the hooks they use;
// this component is just the responsive shell + "which conversation is
// open" state.
//
// "Announcement" is deliberately NOT another chat conversation type. Ehral
// already had a separate, more capable Announcements system (subject+body
// broadcasts to ALL/HODS_ONLY/INDIVIDUAL, with read receipts —
// com.Ehra.entity.Announcement / AnnouncementService / /api/announcements)
// that predates this messaging feature, reachable before via the old
// MessagesHub's own Chats/Announcements switcher. Selecting that tab here
// swaps the whole two-column chat layout for those same existing
// components (MessagesTab for the composer, EmployeeInbox for the
// read-only view) instead of re-implementing a duplicate broadcast
// mechanism inside the messaging package.
export default function MessagingHub({ onThreadOpenChange }) {
  const { user } = useAuth();
  // user.identityId comes from localStorage (readSession in authApi.js) and
  // is always a STRING, while every identityId the backend sends over
  // REST/WebSocket is a JSON number. Comparing them with === anywhere
  // downstream (isOwn checks, delivery/read/typing matching) would always
  // be false — every message would render as "received", on the wrong
  // side, in the wrong color. Coercing once here, at the single place this
  // value enters the messaging feature, is what fixes that for every
  // consumer below.
  const myIdentityId = user?.identityId != null ? Number(user.identityId) : null;
  const isEmployer = user?.contextType === "EMPLOYER";
  useMessagingConnection();

  const { conversations, loading, error, refresh } = useConversations();
  const [activeId, setActiveId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [tab, setTab] = useState("all");
  // Mirrors onThreadOpenChange locally, the same way the old MessagesHub
  // did, so the tab row itself can hide on mobile once EITHER a chat
  // thread OR one specific announcement is open full-screen — not just
  // the chat-thread case.
  const [detailOpen, setDetailOpen] = useState(false);

  const active = conversations.find((c) => c.id === activeId) || null;
  const showingAnnouncements = tab === "announcement";

  const reportDetailOpen = (open) => {
    setDetailOpen(open);
    onThreadOpenChange?.(open);
  };

  const switchTab = (nextTab) => {
    // Leaving the Chats section always clears mobile full-screen thread
    // state — matches the old MessagesHub's switchSection exactly, so
    // switching tabs never leaves a stale full-screen view behind.
    if (nextTab !== tab) {
      setMobileShowList(true);
      reportDetailOpen(false);
    }
    setTab(nextTab);
  };

  useEffect(() => {
    if (!showingAnnouncements) {
      reportDetailOpen(Boolean(active) && !mobileShowList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mobileShowList, showingAnnouncements]);

  const handleSelect = (id) => {
    setActiveId(id);
    setMobileShowList(false);
  };

  const handleBack = () => {
    setMobileShowList(true);
  };

  const handleCreate = async (payload) => {
    const { data } = await createConversation(payload);
    await refresh();
    setShowNewChat(false);
    switchTab("all");
    handleSelect(data.id);
  };

  const togglePin = (c) => updateConversationState(c.id, { pinned: !c.pinned }).then(refresh);
  const toggleMute = (c) => updateConversationState(c.id, { muted: !c.muted }).then(refresh);
  const toggleArchive = (c) => updateConversationState(c.id, { archived: !c.archived }).then(refresh);

  return (
    <div className={styles.hubOuter}>
      <div className={`${styles.tabRow} ${detailOpen ? styles.tabRowHiddenMobile : ""}`}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showingAnnouncements ? (
        <div className={styles.announcementsPane}>
          {isEmployer ? (
            <MessagesTab onDetailOpenChange={reportDetailOpen} />
          ) : (
            <EmployeeInbox onUnreadCountChange={() => {}} onDetailOpenChange={reportDetailOpen} />
          )}
        </div>
      ) : (
        <div className={styles.hub}>
          <div className={`${styles.listCol} ${!mobileShowList ? styles.listColHiddenMobile : ""}`}>
            <ChatList
              tab={tab}
              conversations={conversations}
              loading={loading}
              error={error}
              onRetry={refresh}
              activeId={activeId}
              onSelect={handleSelect}
              onNewGroup={() => setShowNewChat(true)}
              onTogglePin={togglePin}
              onToggleMute={toggleMute}
              onToggleArchive={toggleArchive}
            />
          </div>

          <div className={`${styles.windowCol} ${mobileShowList ? styles.windowColHiddenMobile : ""}`}>
            {active ? (
              <ChatWindow
                key={active.id}
                conversation={active}
                myIdentityId={myIdentityId}
                onBack={handleBack}
                onConversationChanged={refresh}
              />
            ) : (
              <div className={styles.emptyPane}>
                <div className={styles.emptyIcon}>
                  <i className="ti ti-message-2" />
                </div>
                <h2>Your messages</h2>
                <p>Connect with employees, businesses and customers through Ehral.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleCreate} />}
    </div>
  );
}