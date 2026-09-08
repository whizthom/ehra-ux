import { useEffect, useRef, useState, useCallback } from "react";
import {
  sendAgentMessage,
  executeAgentAction,
  fetchAgentBriefing,
} from "../../api/agentApi";
import Logo from "../Logo";
import styles from "./AiAgentWidget.module.css";

const SUGGESTED_PROMPTS = [
  "How is my business doing?",
  "Show today's attendance",
  "What needs my attention?",
  "Give me business suggestions",
];

let messageIdCounter = 0;
const nextMessageId = () => `agent-${++messageIdCounter}`;

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
  const cleaned = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .trim();
  const lines = cleaned.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i += 1;
      continue;
    }

    const label = line.replace(/:$/, "");
    const isLabel =
      label.length <= 52 &&
      /^(Business Snapshot|Business Identity|Contact and Verification|Workforce|Attendance|Leave|Payroll|Financials|Operations|Assessment|Recommended Actions|Recommendations|Observations|Next Steps|Priority Actions|Key Findings|Management Overview|What Stands Out|About Ehral|Founder Information|Business Pulse|Attention Required|Suggested Next Steps)$/i.test(
        label,
      );

    if (isLabel) {
      blocks.push(
        <h3 key={`b-${i}`} className={styles.responseHeading}>
          {renderInline(label, `heading-${i}`)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items = [];
      const start = i;
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
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

    const paragraph = [line];
    const start = i;
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim())
    ) {
      const next = lines[i].trim().replace(/^#{1,6}\s+/, "");
      paragraph.push(next);
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

function getSuggestions(content) {
  const text = String(content || "").toLowerCase();
  if (
    text.includes("attendance") ||
    text.includes("absent") ||
    text.includes("present")
  ) {
    return [
      "Would you like me to show who is absent and why?",
      "Would you like me to compare attendance across departments?",
      "Would you like me to suggest the first issue to investigate?",
    ];
  }
  if (text.includes("leave")) {
    return [
      "Would you like me to show pending leave requests?",
      "Would you like me to break leave down by department?",
      "Would you like me to check who is expected back soon?",
    ];
  }
  if (
    text.includes("payroll") ||
    text.includes("deduction") ||
    text.includes("salary")
  ) {
    return [
      "Would you like me to compare the latest payroll period?",
      "Would you like me to show the largest deductions?",
      "Would you like me to explain what the payroll figures suggest?",
    ];
  }
  if (
    text.includes("workforce") ||
    text.includes("employee") ||
    text.includes("department") ||
    text.includes("branch")
  ) {
    return [
      "Would you like me to identify the workforce areas needing attention?",
      "Would you like me to compare departments or branches?",
      "Would you like me to turn this into practical next steps?",
    ];
  }
  return [
    "Would you like me to go deeper into this?",
    "Would you like me to identify what deserves your attention first?",
    "Would you like practical next steps based on this?",
  ];
}

function describeError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 402)
    return (
      detail ||
      "You've reached your monthly AI allowance. Upgrade your plan to continue."
    );
  if (status === 429)
    return "Too many requests. Please wait a moment and try again.";
  if (status === 403)
    return detail || "This isn't available on your current plan.";
  if (!err?.response)
    return "Couldn't reach Ehral Intelligence. Check your connection and try again.";
  return detail || "Something went wrong. Please try again.";
}

function TypingIndicator() {
  return (
    <div className={styles.thinking} aria-live="polite">
      <span className={styles.thinkingMark}>
        <Logo variant="icon" size={18} title="Ehral" />
      </span>
      <span className={styles.thinkingText}>Ehral is thinking</span>
      <span className={styles.thinkingDots} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function AgentWorkspace({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [greeting, setGreeting] = useState(null);
  const [briefingInsights, setBriefingInsights] = useState([]);
  const [typingMessageId, setTypingMessageId] = useState(null);

  const conversationIdRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const briefingFetchedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    if (!briefingFetchedRef.current) {
      briefingFetchedRef.current = true;
      fetchAgentBriefing()
        .then((data) => {
          setGreeting(data?.greeting || null);
          setBriefingInsights(
            Array.isArray(data?.insights) ? data.insights : [],
          );
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, pendingConfirmation, typingMessageId]);

  useEffect(() => {
    const message = messages.find((m) => m.id === typingMessageId);
    if (!message) return undefined;
    if (message.displayedContent.length >= message.content.length) {
      setTypingMessageId(null);
      return undefined;
    }

    const nextChar = message.content[message.displayedContent.length];
    const delay = /[.!?]/.test(nextChar) ? 22 : /[,;:]/.test(nextChar) ? 12 : 7;
    const timer = window.setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                displayedContent: m.content.slice(
                  0,
                  m.displayedContent.length + 1,
                ),
              }
            : m,
        ),
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [messages, typingMessageId]);

  const appendMessage = useCallback(
    (role, content, extra = {}, type = false) => {
      const id = nextMessageId();
      setMessages((prev) => [
        ...prev,
        { id, role, content, displayedContent: type ? "" : content, ...extra },
      ]);
      if (type) setTypingMessageId(id);
      return id;
    },
    [],
  );

  const handleCopy = useCallback(async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {}
  }, []);

  const handleSend = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || loading || typingMessageId) return;
      setInput("");
      setPendingConfirmation(null);
      appendMessage("user", text);
      setLoading(true);
      try {
        const data = await sendAgentMessage(text, conversationIdRef.current);
        conversationIdRef.current = data.conversation_id;
        appendMessage(
          "assistant",
          data.message.content,
          { usedBusinessData: data.used_business_data },
          true,
        );
        if (data.pending_confirmation)
          setPendingConfirmation(data.pending_confirmation);
      } catch (err) {
        appendMessage("assistant", describeError(err), { isError: true }, true);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, typingMessageId, appendMessage],
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingConfirmation) return;
    setConfirming(true);
    try {
      const result = await executeAgentAction(pendingConfirmation.token);
      if (result.status === "success" || result.status === "already_executed") {
        appendMessage(
          "assistant",
          `Completed: ${pendingConfirmation.tool_name} for ${pendingConfirmation.target}.`,
          {},
          true,
        );
      } else {
        appendMessage(
          "assistant",
          result.failure_reason || "That action couldn't be completed.",
          { isError: true },
          true,
        );
      }
    } catch (err) {
      appendMessage("assistant", describeError(err), { isError: true }, true);
    } finally {
      setConfirming(false);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, appendMessage]);

  const handleCancelConfirmation = useCallback(() => {
    appendMessage(
      "assistant",
      "Understood. I won't make that change.",
      {},
      true,
    );
    setPendingConfirmation(null);
  }, [appendMessage]);

  const onSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <section className={styles.workspace} aria-label="Ehral Intelligence">
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceIdentity}>
          <div className={styles.workspaceLogo}>
            <Logo variant="icon" size={24} title="Ehral" />
          </div>
          <div>
            <div className={styles.eyebrow}>EHRAL INTELLIGENCE</div>
            <h1>Business intelligence, in conversation.</h1>
          </div>
        </div>
        <button
          type="button"
          className={styles.workspaceBack}
          onClick={onClose}
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>Back</span>
        </button>
      </header>

      <div className={styles.workspaceBody} ref={bodyRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.heroMark}>
              <Logo variant="icon" size={54} title="Ehral" />
            </div>
            <span className={styles.liveBadge}>
              <i /> Connected to your Ehral workspace
            </span>
            <p className={styles.heroKicker}>YOUR BUSINESS, UNDERSTOOD</p>
            <h2>
              {greeting ? `${greeting}.` : "What would you like to understand?"}
            </h2>
            <p className={styles.heroDescription}>
              Ask Ehral about your workforce, attendance, leave, payroll, or the
              operational decisions that need your attention.
            </p>

            {briefingInsights.length > 0 && (
              <div className={styles.insightGrid}>
                {briefingInsights.slice(0, 3).map((insight, i) => (
                  <div
                    key={i}
                    className={`${styles.insightCard} ${insight.severity ? styles[`severity${insight.severity}`] || "" : ""}`}
                  >
                    <span className={styles.insightSignal} />
                    <div>
                      <strong>{insight.title}</strong>
                      <p>{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.promptArea}>
              <span>Start with a question</span>
              <div className={styles.promptGrid}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className={styles.promptCard}
                    onClick={() => handleSend(prompt)}
                  >
                    <span>{prompt}</span>
                    <i className="ti ti-arrow-up-right" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.conversation}>
            {messages.map((m, index) => {
              const isTyping = m.id === typingMessageId;
              const isLatestAssistant =
                m.role === "assistant" &&
                index === messages.length - 1 &&
                !isTyping &&
                !m.isError;
              return (
                <article
                  key={m.id}
                  className={`${styles.message} ${m.role === "user" ? styles.userMessage : styles.assistantMessage}`}
                >
                  {m.role === "user" ? (
                    <div className={styles.userMessageInner}>
                      <span className={styles.userLabel}>YOU</span>
                      <p>{m.content}</p>
                    </div>
                  ) : (
                    <div className={styles.assistantMessageInner}>
                      <div className={styles.assistantIdentity}>
                        <span className={styles.assistantLogo}>
                          <Logo variant="icon" size={17} title="Ehral" />
                        </span>
                        <span>Ehral</span>
                        {m.usedBusinessData && (
                          <span className={styles.verified}>
                            <i className="ti ti-check" /> Verified workspace
                            data
                          </span>
                        )}
                      </div>
                      <div
                        className={`${styles.answer} ${m.isError ? styles.errorAnswer : ""}`}
                      >
                        <AgentRichText content={m.displayedContent} />
                      </div>
                      {isLatestAssistant && (
                        <div className={styles.afterAnswer}>
                          <div className={styles.answerTools}>
                            <button
                              type="button"
                              onClick={() => handleCopy(m.content)}
                            >
                              <i className="ti ti-copy" /> Copy
                            </button>
                          </div>
                          <div className={styles.suggestionBlock}>
                            <span className={styles.suggestionLead}>
                              I can take this one step further
                            </span>
                            <div className={styles.suggestionList}>
                              {getSuggestions(m.content).map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => handleSend(suggestion)}
                                  disabled={loading || typingMessageId}
                                >
                                  {suggestion}
                                  <i className="ti ti-arrow-right" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {pendingConfirmation && (
              <div className={styles.confirmCard}>
                <div className={styles.confirmIcon}>
                  <i className="ti ti-shield-check" />
                </div>
                <div className={styles.confirmCopy}>
                  <span className={styles.confirmEyebrow}>
                    ACTION REQUIRES YOUR APPROVAL
                  </span>
                  <strong>{pendingConfirmation.tool_name}</strong>
                  <p>{pendingConfirmation.target}</p>
                  <span className={styles.confirmRisk}>
                    {pendingConfirmation.risk_level} risk
                  </span>
                </div>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    onClick={handleCancelConfirmation}
                    disabled={confirming}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirming}
                  >
                    {confirming ? "Working..." : "Approve action"}
                  </button>
                </div>
              </div>
            )}
            {loading && <TypingIndicator />}
          </div>
        )}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <div className={styles.composerShell}>
          <div className={styles.composerBrand}>
            <Logo variant="icon" size={18} title="Ehral" />
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Ehral anything about your business..."
            disabled={loading || !!typingMessageId}
            aria-label="Ask Ehral"
          />
          <button
            type="submit"
            disabled={loading || !!typingMessageId || !input.trim()}
            aria-label="Send question"
          >
            <i className="ti ti-arrow-up" />
          </button>
        </div>
        <span className={styles.composerHint}>
          Ehral uses the information available in your workspace to ground its
          answers.
        </span>
      </form>
    </section>
  );
}

export default function AiAgentWidget({ onOpen, fullPage = false, onClose }) {
  if (fullPage) return <AgentWorkspace onClose={onClose} />;
  return (
    <button
      type="button"
      className={styles.launcher}
      onClick={onOpen}
      aria-label="Open Ehral Intelligence"
      title="Ehral Intelligence"
    >
      <span className={styles.launcherPulseRing} aria-hidden="true" />
      <Logo variant="icon" size={19} title="Ehral" />
    </button>
  );
}
