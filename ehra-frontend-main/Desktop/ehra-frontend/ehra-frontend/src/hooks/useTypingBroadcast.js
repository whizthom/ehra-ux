import { useCallback, useEffect, useRef } from "react";
import { sendTypingStart, sendTypingStop } from "../services/messagingSocket";

const IDLE_MS = 2500;
const RESEND_THROTTLE_MS = 2000;

// Debounced/throttled typing-indicator broadcast (section 10): sends
// TYPING_START at most once every RESEND_THROTTLE_MS while the person
// keeps typing, then TYPING_STOP once they've paused for IDLE_MS or sent
// the message — never a START/STOP pair per keystroke.
export default function useTypingBroadcast(conversationId) {
  const idleTimer = useRef(null);
  const lastSentAt = useRef(0);
  const isTyping = useRef(false);

  const stop = useCallback(() => {
    if (isTyping.current) {
      sendTypingStop(conversationId);
      isTyping.current = false;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, [conversationId]);

  const onKeystroke = useCallback(() => {
    const now = Date.now();
    if (!isTyping.current || now - lastSentAt.current > RESEND_THROTTLE_MS) {
      sendTypingStart(conversationId);
      isTyping.current = true;
      lastSentAt.current = now;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, IDLE_MS);
  }, [conversationId, stop]);

  useEffect(() => stop, [conversationId, stop]);

  return { onKeystroke, stop };
}