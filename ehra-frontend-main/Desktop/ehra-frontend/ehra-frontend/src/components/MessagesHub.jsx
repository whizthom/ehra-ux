import { useState, useEffect, useCallback } from "react";
import ChatPanel from "./ChatPanel";
import MessagesTab from "./MessagesTab";
import EmployeeInbox from "./EmployeeMessagesInbox";
import { getChatUnreadCount } from "../api/chatApi";
import useMessageStream from "../hooks/useMessageStream";
import styles from "./MessagesHub.module.css";

/**
 * The single entry point for both real conversation (Chats) and one-way
 * official notices (Announcements) — two clearly separate sections under
 * one tab, the way WhatsApp keeps normal chats and "official" broadcasts
 * conceptually distinct even though you reach both from the same place.
 *
 * @param {"admin"|"employee"} viewer
 * @param {array} employees - only used by the admin's Announcements composer
 */
export default function MessagesHub({
  viewer = "employee",
  employees = [],
  onThreadOpenChange,
}) {
  const [section, setSection] = useState("chats"); // "chats" | "announcements"
  const [chatUnread, setChatUnread] = useState(0);
  const [announcementUnread, setAnnouncementUnread] = useState(0);

  const switchSection = (next) => {
    if (next !== "chats") onThreadOpenChange?.(false); // leaving Chats always clears full-screen mode
    setSection(next);
  };

  const refreshChatUnread = useCallback(async () => {
    try {
      const { data } = await getChatUnreadCount();
      setChatUnread(data.count || 0);
    } catch {
      /* badge is a nice-to-have, fail silently */
    }
  }, []);

  useEffect(() => {
    refreshChatUnread();
  }, [refreshChatUnread]);

  // Keep the badge live without needing the Chats section mounted.
  useMessageStream({
    onNewChatMessage: () => refreshChatUnread(),
    onChatRead: () => refreshChatUnread(),
  });

  // While the Chats section is open, its own thread-open logic already
  // marks things read — re-sync the badge whenever we leave that section.
  useEffect(() => {
    if (section !== "chats") refreshChatUnread();
  }, [section, refreshChatUnread]);

  return (
    <div className={styles.container}>
      <div className={styles.switcher}>
        <button
          className={`${styles.switchBtn} ${section === "chats" ? styles.switchActive : ""}`}
          onClick={() => switchSection("chats")}
        >
          <i className="ti ti-message-circle-2" />
          Chats
          {chatUnread > 0 && (
            <span className={styles.switchBadge}>{chatUnread}</span>
          )}
        </button>
        <button
          className={`${styles.switchBtn} ${section === "announcements" ? styles.switchActive : ""}`}
          onClick={() => switchSection("announcements")}
        >
          <i className="ti ti-speakerphone" />
          Announcements
          {viewer === "employee" && announcementUnread > 0 && (
            <span className={styles.switchBadge}>{announcementUnread}</span>
          )}
        </button>
      </div>

      <div className={styles.body}>
        {section === "chats" ? (
          <ChatPanel viewer={viewer} onThreadOpenChange={onThreadOpenChange} />
        ) : viewer === "admin" ? (
          <MessagesTab
            employees={employees}
            onDetailOpenChange={onThreadOpenChange}
          />
        ) : (
          <EmployeeInbox
            onUnreadCountChange={setAnnouncementUnread}
            onDetailOpenChange={onThreadOpenChange}
          />
        )}
      </div>
    </div>
  );
}
