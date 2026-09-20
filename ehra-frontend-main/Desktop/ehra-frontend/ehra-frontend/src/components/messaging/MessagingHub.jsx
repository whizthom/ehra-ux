import { useEffect, useMemo, useState } from "react";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import NewChatModal from "./NewChatModal";
import NewCustomerChatModal from "./NewCustomerChatModal";
import NewBusinessChatModal from "./NewBusinessChatModal";
import CustomerAnnouncementsManager from "./CustomerAnnouncementsManager";
import CustomerAnnouncementsInbox from "./CustomerAnnouncementsInbox";
import MessagesTab from "../MessagesTab";
import EmployeeInbox from "../EmployeeMessagesInbox";
import { useAuth } from "../../context/AuthContext";
import useConversations from "../../hooks/useConversations";
import useCustomerInboxBadge from "../../hooks/useCustomerInboxBadge";
import {
  CHANNEL_CUSTOMER,
  CHANNEL_STAFF,
  createConversation,
  createCustomerBusinessConversation,
  openCustomerConversation,
  updateConversationState,
} from "../../api/messagingApi";
import styles from "./MessagingHub.module.css";

// Which inbox the hub is showing, and for whom:
//
//   "staff"    the original workplace messaging (Employer <-> Employee,
//              groups) in the generic employer / employee dashboards.
//   "business" a business-type workspace (e.g. the Retail Workspace): the
//              employer - or an employee the employer has allowed - talking
//              to the business's CUSTOMERS, one shared thread per customer,
//              plus announcements to all customers at once.
//   "customer" the customer's own Ehral account: their chats with the
//              businesses they follow, plus those businesses' announcements.
//
// Every mode reuses the SAME list, window, composer and bubbles, so
// attachments, voice notes, reactions, replies, edit/delete, typing,
// presence and read ticks all behave identically everywhere. Only the
// channel (which inbox), the tabs, and the copy differ.
const MODES = {
  staff: {
    channel: CHANNEL_STAFF,
    tabs: [
      { key: "all", label: "All" },
      { key: "group", label: "Group" },
      { key: "announcement", label: "Announcement" },
      { key: "archived", label: "Archived" },
    ],
  },
  business: {
    channel: CHANNEL_CUSTOMER,
    tabs: [
      { key: "all", label: "All" },
      { key: "unread", label: "Unread" },
      { key: "announcement", label: "Announcements" },
      { key: "archived", label: "Archived" },
    ],
    searchPlaceholder: "Search customers or messages",
    composeLabel: "Message a customer",
    emptyTitle: "No customer conversations yet",
    emptyText:
      "Message a customer to start a conversation - or wait for one to reach out to you. Every reply from your team lands in the same thread.",
    emptyPaneTitle: "Your customer messages",
    emptyPaneText:
      "Chat with the customers linked to your business. Your team shares each conversation, so nobody gets left waiting.",
  },
  customer: {
    channel: CHANNEL_CUSTOMER,
    tabs: [
      { key: "all", label: "All" },
      { key: "unread", label: "Unread" },
      { key: "announcement", label: "Announcements" },
      { key: "archived", label: "Archived" },
    ],
    searchPlaceholder: "Search businesses or messages",
    composeLabel: "Message a business",
    emptyTitle: "No conversations yet",
    emptyText:
      "Message a business you've ordered from or follow on Ehral - ask about products, orders, delivery or availability.",
    emptyPaneTitle: "Your messages",
    emptyPaneText: "Talk directly with the businesses you're connected to, without leaving Ehral.",
  },
};

// Drop-in replacement for the old <MessagesHub /> (SSE-based, text-only,
// employee<->manager-only). Same props the dashboards already pass
// (`onThreadOpenChange`, `deepLink`, ...); `mode` defaults to "staff", so the
// existing employer / employee dashboards are unchanged.
//
// "Announcement" is deliberately NOT another chat conversation type. Ehral
// has a separate, more capable announcements system (subject + body
// broadcasts with read receipts). Selecting that tab swaps the whole
// two-column chat layout for it:
//   staff     -> MessagesTab (employer composer) / EmployeeInbox
//   business  -> CustomerAnnouncementsManager (announce to all customers)
//   customer  -> CustomerAnnouncementsInbox (with reply)
export default function MessagingHub({
  mode = "staff",
  onThreadOpenChange,
  deepLink,
  onDeepLinkConsumed,
  onActiveConversationChange,
  // customer mode: the businesses the customer is connected to, for the
  // "Message a business" picker (from the customer overview)
  businesses,
  // called whenever something the parent's unread badge depends on changed
  onBadgeChange,
}) {
  const config = MODES[mode] || MODES.staff;
  const channel = config.channel;
  const isStaffMode = mode === "staff";

  const { user } = useAuth();
  // user.identityId comes from localStorage (readSession in authApi.js) and
  // is always a STRING, while every identityId the backend sends over
  // REST/WebSocket is a JSON number. Comparing them with === anywhere
  // downstream (isOwn checks, delivery/read/typing matching) would always
  // be false - every message would render as "received", on the wrong
  // side, in the wrong color. Coercing once here, at the single place this
  // value enters the messaging feature, is what fixes that for every
  // consumer below.
  const myIdentityId = user?.identityId != null ? Number(user.identityId) : null;
  const isEmployer = user?.contextType === "EMPLOYER";
  // The actual WebSocket connection is opened once, at the top of the
  // page (Dashboard / EmployeeDashboard / RetailWorkspace / CustomerDashboard),
  // NOT here - see useMessagingConnection's own doc for why mounting it only
  // inside this component (which only exists while the Messages tab is
  // active) would make presence and notifications depend on the chat list
  // having been opened first.

  const { conversations, loading, error, refresh } = useConversations(channel);
  const [activeId, setActiveId] = useState(null);
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [tab, setTab] = useState("all");
  // A draft handed over by a deep link (e.g. text typed on a business page
  // before the chat existed) - applied once to that conversation's composer.
  const [draft, setDraft] = useState({ conversationId: null, text: "" });
  // Mirrors onThreadOpenChange locally so the tab row itself can hide on
  // mobile once EITHER a chat thread OR one specific announcement is open
  // full-screen - not just the chat-thread case.
  const [detailOpen, setDetailOpen] = useState(false);

  // Announcement unread (customer mode only) - shown on the tab itself.
  const { announcementUnread, setAnnouncementUnread } = useCustomerInboxBadge({
    enabled: mode === "customer",
    includeAnnouncements: true,
  });

  const active = conversations.find((c) => c.id === activeId) || null;
  const showingAnnouncements = tab === "announcement";
  const unreadChats = useMemo(
    () => conversations.filter((c) => !c.archived && Number(c.unreadCount) > 0).length,
    [conversations],
  );

  // Reports which conversation is on screen up to the page, which uses it to
  // suppress a notification toast for whatever the person is already looking
  // at (see NotificationToastStack.jsx). Reset on unmount so navigating away
  // doesn't leave a stale conversation permanently suppressed.
  useEffect(() => {
    onActiveConversationChange?.(activeId);
    return () => onActiveConversationChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const reportDetailOpen = (open) => {
    setDetailOpen(open);
    onThreadOpenChange?.(open);
  };

  const switchTab = (nextTab) => {
    // Leaving the Chats section always clears mobile full-screen thread
    // state, so switching tabs never leaves a stale full-screen view behind.
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

  const handleSelect = (id, messageId, draftText) => {
    setActiveId(id);
    setHighlightMessageId(messageId ?? null);
    setMobileShowList(false);
    if (draftText) setDraft({ conversationId: id, text: draftText });
  };

  // Consumes an externally-requested deep link (a clicked toast, a
  // "Message" button elsewhere on the page). Makes sure the "All" tab - not
  // Group/Archived, which could hide the target - is what's showing, and
  // reloads the list if the conversation isn't in it yet (a thread that was
  // just created).
  useEffect(() => {
    if (!deepLink) return;
    if (tab !== "all") setTab("all");
    handleSelect(deepLink.conversationId, deepLink.messageId, deepLink.draft);
    if (!conversations.some((c) => c.id === deepLink.conversationId)) refresh();
    onDeepLinkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const handleBack = () => {
    setMobileShowList(true);
  };

  const openThread = async (conversationId, messageId) => {
    await refresh();
    switchTab("all");
    handleSelect(conversationId, messageId);
    onBadgeChange?.();
  };

  // Staff: group creation (workplace inbox only).
  const handleCreateGroup = async (payload) => {
    const { data } = await createConversation(payload);
    await refresh();
    setShowNewChat(false);
    switchTab("all");
    handleSelect(data.id);
  };

  // Business mode: open (or create) the shared thread with a customer.
  const handlePickCustomer = async (customer) => {
    const { data } = await openCustomerConversation(customer.identityId);
    setShowNewChat(false);
    await openThread(data.id);
  };

  // Customer mode: open (or create) the thread with a business.
  const handlePickBusiness = async (business) => {
    const { data } = await createCustomerBusinessConversation(business.businessId);
    setShowNewChat(false);
    await openThread(data.id);
  };

  const togglePin = (c) => updateConversationState(c.id, { pinned: !c.pinned }).then(refresh);
  const toggleMute = (c) => updateConversationState(c.id, { muted: !c.muted }).then(refresh);
  const toggleArchive = (c) => updateConversationState(c.id, { archived: !c.archived }).then(refresh);

  const tabBadge = (key) => {
    if (key === "unread") return unreadChats;
    if (key === "announcement" && mode === "customer") return announcementUnread;
    return 0;
  };

  return (
    <div className={styles.hubOuter}>
      <div className={`${styles.tabRow} ${detailOpen ? styles.tabRowHiddenMobile : ""}`}>
        {config.tabs.map((t) => {
          const badge = tabBadge(t.key);
          return (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
              {badge > 0 && <span className={styles.tabCount}>{badge > 99 ? "99+" : badge}</span>}
            </button>
          );
        })}
      </div>

      {showingAnnouncements ? (
        <div className={styles.announcementsPane}>
          {mode === "business" ? (
            <CustomerAnnouncementsManager onDetailOpenChange={reportDetailOpen} />
          ) : mode === "customer" ? (
            <CustomerAnnouncementsInbox
              onDetailOpenChange={reportDetailOpen}
              onUnreadCountChange={(n) => {
                setAnnouncementUnread(n);
                onBadgeChange?.();
              }}
              onOpenConversation={openThread}
            />
          ) : isEmployer ? (
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
              channel={channel}
              searchPlaceholder={config.searchPlaceholder}
              emptyTitle={config.emptyTitle}
              emptyText={config.emptyText}
              emptyActionLabel={config.composeLabel}
              onEmptyAction={isStaffMode ? undefined : () => setShowNewChat(true)}
              onCompose={isStaffMode ? undefined : () => setShowNewChat(true)}
              composeLabel={config.composeLabel}
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
                highlightMessageId={highlightMessageId}
                initialDraft={draft.conversationId === active.id ? draft.text : undefined}
              />
            ) : (
              <div className={styles.emptyPane}>
                <div className={styles.emptyIcon}>
                  <i className="ti ti-message-2" />
                </div>
                <h2>{config.emptyPaneTitle || "Your messages"}</h2>
                <p>
                  {config.emptyPaneText ||
                    "Connect with employees, businesses and customers through Ehral."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showNewChat && isStaffMode && (
        <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleCreateGroup} />
      )}
      {showNewChat && mode === "business" && (
        <NewCustomerChatModal onClose={() => setShowNewChat(false)} onPick={handlePickCustomer} />
      )}
      {showNewChat && mode === "customer" && (
        <NewBusinessChatModal
          businesses={businesses || []}
          onClose={() => setShowNewChat(false)}
          onPick={handlePickBusiness}
        />
      )}
    </div>
  );
}
