import { useEffect, useState } from "react";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import NewChatModal from "./NewChatModal";
import { useAuth } from "../../context/AuthContext";
import useConversations from "../../hooks/useConversations";
import useMessagingConnection from "../../hooks/useMessagingConnection";
import {
  createConversation,
  updateConversationState,
} from "../../api/messagingApi";
import styles from "./MessagingHub.module.css";

// Drop-in replacement for the old <MessagesHub /> (SSE-based, text-only,
// employee<->manager-only). Same two props the dashboards already pass
// (`viewer`, `onThreadOpenChange`) so wiring it in was a one-line import
// swap in Dashboard.jsx / EmployeeDashboard.jsx — see those files. Every
// requirement from section 3 onward (groups, attachments, reactions,
// presence, etc.) lives inside ChatList/ChatWindow and the hooks they use;
// this component is just the responsive shell + "which conversation is
// open" state.
export default function MessagingHub({ onThreadOpenChange }) {
  const { user } = useAuth();
  useMessagingConnection();

  const { conversations, loading, refresh } = useConversations();
  const [activeId, setActiveId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);

  const active = conversations.find((c) => c.id === activeId) || null;

  useEffect(() => {
    onThreadOpenChange?.(Boolean(activeId) && !mobileShowList);
  }, [activeId, mobileShowList, onThreadOpenChange]);

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
    handleSelect(data.id);
  };

  const togglePin = (c) =>
    updateConversationState(c.id, { pinned: !c.pinned }).then(refresh);
  const toggleMute = (c) =>
    updateConversationState(c.id, { muted: !c.muted }).then(refresh);
  const toggleArchive = (c) =>
    updateConversationState(c.id, { archived: !c.archived }).then(refresh);

  return (
    <div className={styles.hub}>
      <div
        className={`${styles.listCol} ${!mobileShowList ? styles.listColHiddenMobile : ""}`}
      >
        <ChatList
          conversations={conversations}
          loading={loading}
          activeId={activeId}
          onSelect={handleSelect}
          onNewChat={() => setShowNewChat(true)}
          onTogglePin={togglePin}
          onToggleMute={toggleMute}
          onToggleArchive={toggleArchive}
        />
      </div>

      <div
        className={`${styles.windowCol} ${mobileShowList ? styles.windowColHiddenMobile : ""}`}
      >
        {active ? (
          <ChatWindow
            key={active.id}
            conversation={active}
            myIdentityId={user?.identityId}
            onBack={handleBack}
            onConversationChanged={refresh}
          />
        ) : (
          <div className={styles.emptyPane}>
            <div className={styles.emptyIcon}>
              <i className="ti ti-message-2" />
            </div>
            <h2>Your messages</h2>
            <p>
              Connect with employees, businesses and customers through Ehral.
            </p>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
