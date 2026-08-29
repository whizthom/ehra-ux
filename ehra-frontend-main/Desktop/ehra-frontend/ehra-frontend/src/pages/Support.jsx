import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import Logo from "../components/Logo";
import {
  createConversation,
  getMyConversations,
  getConversationMessages,
  sendConversationMessage,
} from "../api/supportApi";
import styles from "./Support.module.css";

// The customer-facing half of the Support Inbox — reachable via the
// "Help & Support" nav item added to Dashboard.jsx/EmployeeDashboard.jsx
// (isFullPage: true, route: "/support", same mechanism as My Accounts).
// Talks to com.Ehra.support.controller.SupportEntryController; the
// staff-facing half lives entirely in the separate Ops Console app —
// nothing here can see internal notes or other customers' conversations
// (enforced server-side, not just hidden client-side).
//
// Deliberately its OWN lightweight header rather than cloning the full
// Dashboard/EmployeeDashboard sidebar shell (that shared shell is
// several thousand lines with scroll-position tracking, HOD-gating,
// admin/employee NAV switching, etc. — safer to keep this screen
// self-contained than risk a subtle bug in code this page doesn't
// otherwise touch). "Back to Dashboard" returns to wherever the person
// came from.

const CATEGORIES = [
  "Account",
  "Login",
  "Employee",
  "Attendance",
  "Leave",
  "Payroll",
  "Payments",
  "Subscription",
  "Branch",
  "Notifications",
  "Technical",
  "Integration",
  "Other",
];

const STATUS_LABEL = {
  NEW: "New",
  TRIAGED: "Triaged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_FOR_CUSTOMER: "Waiting on you",
  WAITING_FOR_INTERNAL_TEAM: "With our team",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const day = d.getDate();
  const s = ["th", "st", "nd", "rd"];
  const suffix =
    day % 100 >= 11 && day % 100 <= 13 ? "th" : s[day % 10] || "th";
  return `${day}${suffix} of ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export default function Support() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === "ROLE_ADMIN";
  const backPath =
    location.state?.returnPath || (isAdmin ? "/dashboard" : "/my-dashboard");

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await getMyConversations();
      setConversations(data);
      setListError("");
    } catch {
      setListError("Could not load your conversations. Please try again.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = async (id) => {
    setSelectedId(id);
    setCreating(false);
    setLoadingThread(true);
    try {
      const { data } = await getConversationMessages(id);
      setMessages(data.content);
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const startNew = () => {
    setSelectedId(null);
    setCreating(true);
    setNewSubject("");
    setNewCategory("");
    setNewMessage("");
    setSubmitError("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data } = await createConversation({
        subject: newSubject.trim(),
        message: newMessage.trim(),
        categoryName: newCategory || undefined,
      });
      setCreating(false);
      await loadConversations();
      openConversation(data.id);
    } catch {
      setSubmitError("Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    try {
      const { data } = await sendConversationMessage(selectedId, reply.trim());
      setMessages((prev) => [...prev, data]);
      setReply("");
      loadConversations();
    } catch {
      // Left in the box on failure so nothing typed is lost — no
      // dedicated error banner here since it's a small, retryable action.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backLink} onClick={() => navigate(backPath)}>
          ← Back to Dashboard
        </button>
        <Logo size={28} variant="horizontal" />
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          <i
            className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`}
            aria-hidden="true"
          />
        </button>
      </header>

      <div className={styles.body}>
        <aside className={styles.list}>
          <button className={styles.newBtn} onClick={startNew}>
            <i className="ti ti-plus" aria-hidden="true" /> New conversation
          </button>

          {loadingList ? (
            <p className={styles.muted}>Loading…</p>
          ) : listError ? (
            <p className={styles.errorText}>{listError}</p>
          ) : conversations.length === 0 ? (
            <p className={styles.muted}>You haven't contacted support yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`${styles.convItem} ${selectedId === c.id ? styles.convItemActive : ""}`}
                onClick={() => openConversation(c.id)}
              >
                <div className={styles.convSubject}>{c.subject}</div>
                <div className={styles.convMeta}>
                  {STATUS_LABEL[c.status] || c.status} ·{" "}
                  {formatDate(c.updatedAt)}
                </div>
              </button>
            ))
          )}
        </aside>

        <main className={styles.main}>
          {creating && (
            <form className={styles.createForm} onSubmit={handleCreate}>
              <h2 className={styles.formTitle}>Contact support</h2>
              <p className={styles.muted}>
                Tell us what's going on — our team typically responds within a
                few hours.
              </p>

              {submitError && (
                <div className={styles.errorBox}>{submitError}</div>
              )}

              <label className={styles.label}>Subject</label>
              <input
                className={styles.input}
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Briefly describe the issue"
                required
              />

              <label className={styles.label}>Category (optional)</label>
              <select
                className={styles.input}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="">Not sure / other</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className={styles.label}>Message</label>
              <textarea
                className={styles.textarea}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Give us as much detail as you can…"
                required
              />

              <button
                className={styles.submitBtn}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send to support"}
              </button>
            </form>
          )}

          {!creating && selectedId && (
            <div className={styles.thread}>
              {loadingThread ? (
                <p className={styles.muted}>Loading conversation…</p>
              ) : (
                <>
                  <div className={styles.messages}>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.bubble} ${m.senderType === "CUSTOMER" ? styles.bubbleMine : styles.bubbleTheirs}`}
                      >
                        <div className={styles.bubbleText}>{m.content}</div>
                        <div className={styles.bubbleMeta}>
                          {formatDate(m.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form className={styles.replyForm} onSubmit={handleReply}>
                    <input
                      className={styles.input}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type a reply…"
                    />
                    <button
                      className={styles.submitBtn}
                      type="submit"
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {!creating && !selectedId && (
            <div className={styles.emptyState}>
              <i className="ti ti-headset" aria-hidden="true" />
              <p>Select a conversation, or start a new one.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
