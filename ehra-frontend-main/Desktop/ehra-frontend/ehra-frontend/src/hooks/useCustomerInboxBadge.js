import { useCallback, useEffect, useState } from "react";
import { CHANNEL_CUSTOMER, getMessagingUnreadCount } from "../api/messagingApi";
import { getMyCustomerAnnouncementUnreadCount } from "../api/customerAnnouncementApi";
import { subscribeToUserQueue } from "../services/messagingSocket";
import useMessagingBadgeSync from "./useMessagingBadgeSync";

// Unread badge for the Business <-> Customer inbox, self-contained: the
// nav item of a business-type workspace (business side) or of the
// customer's own account (customer side) just reads `total`.
//
//   chatUnread          unread messages across the CUSTOMER channel only -
//                       the workplace inbox has its own separate badge
//   announcementUnread  unread business announcements (customer side only;
//                       pass includeAnnouncements)
//
// Stays live off the same personal WebSocket queue as everything else - no
// polling. `enabled=false` (e.g. an employee who hasn't been allowed to
// message customers) makes no requests at all.
// Fetches both counts; a failed poll yields null for that count so a
// blip never resets a badge to zero or breaks the page it sits on.
async function fetchCounts(includeAnnouncements) {
  let chat = null;
  let announcements = null;
  try {
    const { data } = await getMessagingUnreadCount(CHANNEL_CUSTOMER);
    chat = Number(data?.count) || 0;
  } catch {
    // ignored - see above
  }
  if (includeAnnouncements) {
    try {
      const { data } = await getMyCustomerAnnouncementUnreadCount();
      announcements = Number(data?.count) || 0;
    } catch {
      // ignored - see above
    }
  }
  return { chat, announcements };
}

export default function useCustomerInboxBadge({ enabled = true, includeAnnouncements = false } = {}) {
  const [chatUnread, setChatUnread] = useState(0);
  const [announcementUnread, setAnnouncementUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { chat, announcements } = await fetchCounts(includeAnnouncements);
    if (chat !== null) setChatUnread(chat);
    if (announcements !== null) setAnnouncementUnread(announcements);
  }, [enabled, includeAnnouncements]);

  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    fetchCounts(includeAnnouncements).then(({ chat, announcements }) => {
      if (dead) return;
      if (chat !== null) setChatUnread(chat);
      if (announcements !== null) setAnnouncementUnread(announcements);
    });
    return () => {
      dead = true;
    };
  }, [enabled, includeAnnouncements]);

  useMessagingBadgeSync(refresh, CHANNEL_CUSTOMER);

  useEffect(() => {
    if (!enabled || !includeAnnouncements) return undefined;
    return subscribeToUserQueue((event) => {
      if (
        event?.type === "CUSTOMER_ANNOUNCEMENT_CREATED" ||
        event?.type === "CUSTOMER_ANNOUNCEMENT_DELETED"
      ) {
        refresh();
      }
    });
  }, [enabled, includeAnnouncements, refresh]);

  // Disabled (e.g. an employee who isn't allowed to message customers) reads
  // as zero regardless of any stale value from before it was disabled.
  const chats = enabled ? chatUnread : 0;
  const announcements = enabled ? announcementUnread : 0;
  return {
    chatUnread: chats,
    announcementUnread: announcements,
    total: chats + announcements,
    refresh,
    setAnnouncementUnread,
  };
}
