import { useEffect, useState } from "react";
import API from "../api/authApi";
import { getMessagingUnreadCount } from "../api/messagingApi";
import { getMyCoverRequests, getPendingEmployerDecisions } from "../api/leaveApi";
import { getPendingProfileEdits } from "../api/profileEditApi";

// The unread / pending counts the employer and employee phone navigation
// (MobileNavHub) shows as badges - for the pages that wear that navigation
// WITHOUT being the dashboard itself (My Accounts, Scan Attendance). The
// dashboards load these same numbers in their own state; this gives the
// standalone pages the identical badges instead of a bar with no counts.
//
//   employer  -> Messages, Notifications, "Profile Edits", Leave
//   employee  -> Messages, Notifications, "Cover Requests"
//
// Same endpoints and the same filtering as the dashboards (admin-only
// ADMIN_MESSAGE notifications are excluded; only unread ones count). Every
// call is best-effort: a failed request just leaves that badge at 0 and
// never breaks the page. Counts are loaded on mount and again whenever the
// tab regains focus, so they don't sit stale while the person is away.

const EMPTY = {};

const safely = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

const unreadNotifications = (data) =>
  Array.isArray(data) ? data.filter((n) => n?.type !== "ADMIN_MESSAGE" && !n?.isRead).length : 0;

async function loadBadges(role) {
  const messages = safely(() => getMessagingUnreadCount());
  if (role === "employer") {
    const [msg, notifs, leaves, edits] = await Promise.all([
      messages,
      safely(() => API.get("/notifications")),
      safely(() => getPendingEmployerDecisions()),
      safely(() => getPendingProfileEdits()),
    ]);
    return {
      Messages: Number(msg?.data?.count) || 0,
      Notifications: unreadNotifications(notifs?.data),
      Leave: Array.isArray(leaves?.data) ? leaves.data.length : 0,
      "Profile Edits": Array.isArray(edits?.data) ? edits.data.length : 0,
    };
  }
  const [msg, notifs, cover] = await Promise.all([
    messages,
    safely(() => API.get("/notifications/me")),
    safely(() => getMyCoverRequests()),
  ]);
  return {
    Messages: Number(msg?.data?.count) || 0,
    Notifications: unreadNotifications(notifs?.data),
    "Cover Requests": Array.isArray(cover?.data)
      ? cover.data.filter((l) => l?.status === "PENDING_COVER").length
      : 0,
  };
}

/** role: "employer" | "employee" | null (null = do nothing, returns no badges) */
export default function useStaffNavBadges(role) {
  const [badges, setBadges] = useState(EMPTY);

  useEffect(() => {
    if (!role) return undefined;
    let dead = false;
    const refresh = async () => {
      const next = await loadBadges(role);
      if (!dead) setBadges(next);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dead = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [role]);

  return role ? badges : EMPTY;
}