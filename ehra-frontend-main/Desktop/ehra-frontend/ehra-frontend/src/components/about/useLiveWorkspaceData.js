import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import API from "../../api/authApi";
import { getTodayAttendance, getMyAttendance } from "../../api/attendanceApi";
import { getPendingEmployerDecisions, getMyLeaves } from "../../api/leaveApi";
import { getMyAnnouncements } from "../../api/notificationApi";
import { getEmployerContacts, getMyContacts, getThread } from "../../api/chatApi";

const EMPTY = { live: false };

/**
 * Pulls a light, read-only snapshot of the signed-in person's own real
 * workspace so the About page's product-preview components
 * (DashboardPreview / MobileProductPreview) can render genuine data
 * instead of the illustrative mock.
 *
 * About is a public, unauthenticated-by-default page — the overwhelming
 * majority of visitors have no session at all, in which case this hook
 * resolves to `{ live: false }` immediately and every preview quietly
 * renders its static mock, exactly as before. It only switches to real
 * data for the (comparatively rare) case of someone viewing /about
 * while already signed in.
 *
 * Every call below is independently wrapped via Promise.allSettled —
 * one failing (wrong role for that endpoint, an expired session, a
 * contextType the call doesn't apply to) never breaks the others, and
 * if literally nothing comes back, `live` stays false so callers fall
 * back to their mock instead of rendering a half-empty real UI.
 */
export default function useLiveWorkspaceData() {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user) {
        if (!cancelled) setData(EMPTY);
        return;
      }

      const isEmployer = user.role === "ROLE_ADMIN";
      const [summaryR, attendanceR, leaveR, announceR, contactsR] =
        await Promise.allSettled([
          API.get("/business/dashboard-summary"),
          isEmployer ? getTodayAttendance() : getMyAttendance(),
          isEmployer ? getPendingEmployerDecisions() : getMyLeaves(),
          getMyAnnouncements(),
          isEmployer ? getEmployerContacts() : getMyContacts(),
        ]);
      if (cancelled) return;

      const summary = summaryR.status === "fulfilled" ? summaryR.value.data : null;
      const attendanceRaw = attendanceR.status === "fulfilled" ? attendanceR.value.data : null;
      const leavesRaw = leaveR.status === "fulfilled" ? leaveR.value.data : null;
      const announceRaw = announceR.status === "fulfilled" ? announceR.value.data : null;
      const contactsRaw = contactsR.status === "fulfilled" ? contactsR.value.data : null;

      const attendance = Array.isArray(attendanceRaw)
        ? attendanceRaw
        : attendanceRaw
          ? [attendanceRaw]
          : null;
      const leaves = Array.isArray(leavesRaw) ? leavesRaw : null;
      const announcements = Array.isArray(announceRaw) ? announceRaw : null;
      const contacts = Array.isArray(contactsRaw) ? contactsRaw : null;

      // A thread is only worth fetching if we actually have someone to
      // fetch it for — and it's allowed to fail silently on its own,
      // same as everything above.
      let thread = null;
      if (contacts && contacts.length > 0 && contacts[0]?.withKey) {
        try {
          const { data: threadData } = await getThread(contacts[0].withKey);
          if (!cancelled && Array.isArray(threadData)) thread = threadData;
        } catch {
          // chat preview just falls back to its mock bubbles
        }
      }

      const live = [summary, attendance, leaves, announcements, contacts].some(
        (v) => v != null,
      );

      if (!cancelled) {
        setData({ live, isEmployer, summary, attendance, leaves, announcements, contacts, thread });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return data;
}