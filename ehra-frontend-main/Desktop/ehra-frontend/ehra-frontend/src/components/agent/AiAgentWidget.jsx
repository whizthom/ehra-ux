import { useEffect, useRef, useState, useCallback } from "react";
import {
  sendAgentMessage,
  executeAgentAction,
  fetchAgentBriefing,
} from "../../api/agentApi";
import styles from "./AiAgentWidget.module.css";

const SUGGESTED_PROMPTS = [
  "How is my business doing?",
  "Show today's attendance",
  "What needs my attention?",
  "Give me business suggestions",
];

let messageIdCounter = 0;
const nextMessageId = () => `m${++messageIdCounter}`;

/**
 * Self-contained Ehral Agent entry point: the pulsing header icon plus
 * the chat panel it opens. Drop <AiAgentWidget /> anywhere in a topbar —
 * it owns all of its own state (open/closed, conversation, messages) and
 * needs nothing passed in, since it authenticates with the same session
 * token the rest of the app already has (see api/agentApi.js).
 *
 * Deliberately does NOT touch the Agent's confirmation/execute split:
 * this component can show a pending confirmation and let the person tap
 * "Confirm", but the actual mutation only ever happens via the separate
 * executeAgentAction() call below — never as a side effect of sending a
 * chat message.
 */

function renderInline(text, keyPrefix = "i") {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

function AgentRichText({ content }) {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length === 2 ? "h2" : "h3";
      const Tag = level;
      blocks.push(
        <Tag
          key={`b-${i}`}
          className={
            level === "h2" ? styles.responseHeading : styles.responseSubheading
          }
        >
          {renderInline(heading[2], `h-${i}`)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      const start = i;
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`b-${start}`} className={styles.responseList}>
          {items.map((item, idx) => (
            <li key={`${start}-${idx}`}>
              {renderInline(item, `ul-${start}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      const start = i;
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`b-${start}`} className={styles.responseList}>
          {items.map((item, idx) => (
            <li key={`${start}-${idx}`}>
              {renderInline(item, `ol-${start}-${idx}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Treat a short all-caps/label-like line as a visual label only when the
    // model omitted Markdown heading syntax. This keeps legacy responses readable.
    if (
      line.length <= 42 &&
      /^(Business Snapshot|Workforce|Attendance|Leave|Financials|Operations|Assessment|Recommended Actions|Recommendations|Observations|Next Steps|Priority Actions|Key Findings|Business Identity|Contact and Verification|About Ehral|Founder Information|What Stands Out|Management Overview)$/i.test(
        line.replace(/:$/, ""),
      )
    ) {
      blocks.push(
        <h2 key={`b-${i}`} className={styles.responseHeading}>
          {renderInline(line.replace(/:$/, ""), `label-${i}`)}
        </h2>,
      );
      i += 1;
      continue;
    }

    const paragraph = [line];
    const start = i;
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{2,3}\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`b-${start}`} className={styles.responseParagraph}>
        {renderInline(paragraph.join(" "), `p-${start}`)}
      </p>,
    );
  }

  return <div className={styles.responseContent}>{blocks}</div>;
}

function getQuickActions(content) {
  const text = String(content || "").toLowerCase();
  if (
    text.includes("attendance") ||
    text.includes("absent") ||
    text.includes("leave")
  ) {
    return [
      "Show attendance details",
      "Who is on leave?",
      "What should I do first?",
    ];
  }
  if (
    text.includes("payroll") ||
    text.includes("deduction") ||
    text.includes("salary")
  ) {
    return [
      "Compare payroll periods",
      "Show the payroll breakdown",
      "What should I do first?",
    ];
  }
  if (
    text.includes("branch") ||
    text.includes("department") ||
    text.includes("workforce")
  ) {
    return [
      "Show the key workforce risks",
      "Compare departments",
      "What should I do first?",
    ];
  }
  return ["What should I do first?", "What stands out?", "Tell me more"];
}

export default function AiAgentWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [greeting, setGreeting] = useState(null);
  const [briefingInsights, setBriefingInsights] = useState([]);

  const conversationIdRef = useRef(null);
  const wrapperRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const briefingFetchedRef = useRef(false);

  // Close on outside click or Escape — same interaction pattern already
  // used for the notifications dropdown elsewhere in this dashboard.
  useEffect(() => {
    if (!open) return undefined;

    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Autoscroll to the newest message/state change.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading, pendingConfirmation]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();

      // Best-effort, once per mount: seeds the empty-state greeting with
      // today's real briefing instead of a generic hello. Failure here
      // is silent and non-blocking — the panel is fully usable as a
      // plain chat either way (section 19's "must never block the
      // user" applies here too, even though this is just a nicety).
      if (!briefingFetchedRef.current) {
        briefingFetchedRef.current = true;
        fetchAgentBriefing()
          .then((data) => {
            setGreeting(data.greeting);
            setBriefingInsights(data.insights || []);
          })
          .catch(() => {
            // Swallow — the panel still works without a briefing.
          });
      }
    }
  }, [open]);

  const appendMessage = useCallback((role, content, extra = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role, content, ...extra },
    ]);
  }, []);

  const describeError = (err) => {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    if (status === 402) {
      return (
        detail ||
        "You've reached your monthly AI allowance. Upgrade your plan to continue."
      );
    }
    if (status === 429) {
      return "Too many requests — please wait a moment and try again.";
    }
    if (status === 403) {
      return detail || "This isn't available on your current plan.";
    }
    if (!err?.response) {
      return "Couldn't reach the Agent — check your connection and try again.";
    }
    return detail || "Something went wrong. Please try again.";
  };

  const handleCopy = useCallback(async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard access can be unavailable in insecure contexts; the response remains readable.
    }
  }, []);

  const handleSend = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      setPendingConfirmation(null);
      appendMessage("user", text);
      setLoading(true);

      try {
        const data = await sendAgentMessage(text, conversationIdRef.current);
        conversationIdRef.current = data.conversation_id;
        appendMessage("assistant", data.message.content, {
          usedBusinessData: data.used_business_data,
        });
        if (data.pending_confirmation) {
          setPendingConfirmation(data.pending_confirmation);
        }
      } catch (err) {
        appendMessage("assistant", describeError(err), { isError: true });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, appendMessage],
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingConfirmation) return;
    setConfirming(true);
    try {
      const result = await executeAgentAction(pendingConfirmation.token);
      if (result.status === "success" || result.status === "already_executed") {
        appendMessage(
          "assistant",
          `Done — ${pendingConfirmation.tool_name} completed for ${pendingConfirmation.target}.`,
        );
      } else {
        appendMessage(
          "assistant",
          result.failure_reason || "That action couldn't be completed.",
          { isError: true },
        );
      }
    } catch (err) {
      appendMessage("assistant", describeError(err), { isError: true });
    } finally {
      setConfirming(false);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, appendMessage]);

  const handleCancelConfirmation = useCallback(() => {
    appendMessage("assistant", "Okay, I won't do that.");
    setPendingConfirmation(null);
  }, [appendMessage]);

  const onSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen((v) => !v)}
        aria-label="Ehral Agent"
        aria-expanded={open}
        title="Ehral Agent — ask me anything"
      >
        <span className={styles.launcherPulseRing} aria-hidden="true" />
        <span className={styles.launcherGlow} aria-hidden="true" />
        <i
          className={`ti ti-sparkles ${styles.launcherIcon}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Ehral Agent chat"
        >
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeft}>
              <span className={styles.panelHeaderIcon}>
                <i className="ti ti-sparkles" aria-hidden="true" />
              </span>
              <div>
                <div className={styles.panelTitle}>Ehral Agent</div>
                <div className={styles.panelSubtitle}>
                  {loading ? "Thinking…" : "Ask about your business"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.panelClose}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          <div className={styles.panelBody} ref={bodyRef}>
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <p className={styles.welcomeGreeting}>
                  {greeting ? `${greeting}!` : "Hi there!"} 👋
                </p>

                {briefingInsights.length > 0 && (
                  <div className={styles.briefingList}>
                    {briefingInsights.map((insight, i) => (
                      <div
                        key={i}
                        className={`${styles.briefingItem} ${
                          insight.severity === "warning"
                            ? styles.briefingWarning
                            : insight.severity === "attention"
                              ? styles.briefingAttention
                              : ""
                        }`}
                      >
                        <div className={styles.briefingItemTitle}>
                          {insight.title}
                        </div>
                        <div className={styles.briefingItemDesc}>
                          {insight.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className={styles.welcomeText}>Or ask me anything, like:</p>
                <div className={styles.suggestions}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => handleSend(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.bubbleRow} ${
                  m.role === "user" ? styles.bubbleRowUser : ""
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    m.role === "user"
                      ? styles.bubbleUser
                      : styles.bubbleAssistant
                  } ${m.isError ? styles.bubbleError : ""}`}
                >
                  <AgentRichText content={m.content} />
                  {m.usedBusinessData && (
                    <div className={styles.bubbleTag}>
                      <i className="ti ti-chart-bar" aria-hidden="true" />{" "}
                      Verified business data
                    </div>
                  )}
                  {m.role === "assistant" && !m.isError && (
                    <div className={styles.messageActions}>
                      <button
                        type="button"
                        className={styles.messageAction}
                        onClick={() => handleCopy(m.content)}
                        title="Copy response"
                        aria-label="Copy response"
                      >
                        <i className="ti ti-copy" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
                {m.role === "assistant" &&
                  !m.isError &&
                  messages[messages.length - 1]?.id === m.id && (
                    <div className={styles.quickActions}>
                      {getQuickActions(m.content).map((action) => (
                        <button
                          key={action}
                          type="button"
                          className={styles.quickAction}
                          onClick={() => handleSend(action)}
                          disabled={loading}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {pendingConfirmation && (
              <div className={styles.confirmCard}>
                <div className={styles.confirmCardHeader}>
                  <i className="ti ti-alert-triangle" aria-hidden="true" />
                  <span>Needs your confirmation</span>
                </div>
                <div className={styles.confirmCardBody}>
                  <div className={styles.confirmCardTool}>
                    {pendingConfirmation.tool_name}
                  </div>
                  <div className={styles.confirmCardTarget}>
                    {pendingConfirmation.target}
                  </div>
                  <span className={styles.confirmCardRisk}>
                    {pendingConfirmation.risk_level} risk
                  </span>
                </div>
                <div className={styles.confirmCardActions}>
                  <button
                    type="button"
                    className={styles.confirmCancel}
                    onClick={handleCancelConfirmation}
                    disabled={confirming}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.confirmAccept}
                    onClick={handleConfirm}
                    disabled={confirming}
                  >
                    {confirming ? "Confirming…" : "Confirm"}
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className={styles.bubbleRow}>
                <div
                  className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleTyping}`}
                >
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}
          </div>

          <form className={styles.inputRow} onSubmit={onSubmit}>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Ehral Agent…"
              disabled={loading}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <i className="ti ti-send" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
