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
const MIN_GAP_MS = 5000;

const safely = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

const unreadNotifications = (data) =>
  Array.isArray(data) ? data.filter((n) => n?.type !== "ADMIN_MESSAGE" && !n?.isRead).length : 0;

// Unread-notification badge. Asks the server for just the number
// (/badge-count applies the same filtering as the list: same feed, admin-only
// ADMIN_MESSAGE excluded, only unread counted) instead of downloading the
// whole notification list on every tab focus only to count it. If the
// endpoint is not there (older backend) or the request fails, fall back to
// the original download-and-count so the badge still works.
async function notificationBadge(role) {
  const countPath = role === "employer" ? "/notifications/badge-count" : "/notifications/me/badge-count";
  const listPath = role === "employer" ? "/notifications" : "/notifications/me";
  const fast = await safely(() => API.get(countPath));
  if (fast && typeof fast.data === "number" && Number.isFinite(fast.data)) {
    return fast.data;
  }
  const list = await safely(() => API.get(listPath));
  return unreadNotifications(list?.data);
}

async function loadBadges(role) {
  const messages = safely(() => getMessagingUnreadCount());
  if (role === "employer") {
    const [msg, notifs, leaves, edits] = await Promise.all([
      messages,
      notificationBadge(role),
      safely(() => getPendingEmployerDecisions()),
      safely(() => getPendingProfileEdits()),
    ]);
    return {
      Messages: Number(msg?.data?.count) || 0,
      Notifications: notifs,
      Leave: Array.isArray(leaves?.data) ? leaves.data.length : 0,
      "Profile Edits": Array.isArray(edits?.data) ? edits.data.length : 0,
    };
  }
  const [msg, notifs, cover] = await Promise.all([
    messages,
    notificationBadge(role),
    safely(() => getMyCoverRequests()),
  ]);
  return {
    Messages: Number(msg?.data?.count) || 0,
    Notifications: notifs,
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
    let inFlight = false;
    let lastStart = 0;
    // Returning to a tab fires BOTH window "focus" and "visibilitychange"
    // within milliseconds of each other, which used to run the whole
    // badge load (several requests, including full notification lists)
    // twice. Skip a refresh that starts while one is running or within
    // MIN_GAP_MS of the last one; a genuine later return still refreshes.
    const refresh = async () => {
      const startedAt = Date.now();
      if (inFlight || startedAt - lastStart < MIN_GAP_MS) return;
      inFlight = true;
      lastStart = startedAt;
      try {
        const next = await loadBadges(role);
        if (!dead) setBadges(next);
      } finally {
        inFlight = false;
      }
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