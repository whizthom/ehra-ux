import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getAccessToken, refreshAccessToken, API_BASE_URL } from "../api/authApi";

// One shared STOMP connection for the whole app — every open chat window,
// the chat list, and the sidebar unread badge all subscribe through this
// same client rather than each opening their own socket. This is the
// "persistent WebSocket connection" section 1 of the spec asks for, plus
// the reconnection/backoff/offline handling section 22 asks for.
//
// The backend authenticates the STOMP CONNECT frame itself (see
// StompAuthChannelInterceptor) — the access token travels as a STOMP
// header, since a browser WebSocket/SockJS connection can't carry a real
// "Authorization" HTTP header the way axios requests can.

const WS_URL = (API_BASE_URL.startsWith("http") ? API_BASE_URL.replace(/\/api\/?$/, "") : "") + "/ws-messaging";

let client = null;
let connectPromise = null;
const topicSubscriptions = new Map(); // destination -> { sub, handlers: Set }
let userQueueSub = null;
const userQueueHandlers = new Set();
const connectionListeners = new Set();
let currentStatus = "disconnected"; // "connecting" | "connected" | "disconnected"

function setStatus(status) {
  currentStatus = status;
  connectionListeners.forEach((fn) => fn(status));
}

function buildClient(token) {
  return new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0, // we drive reconnection ourselves (see scheduleReconnect) so we can refresh the token first
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
    onConnect: () => {
      setStatus("connected");
      resubscribeAll();
    },
    onStompError: () => {
      setStatus("disconnected");
      scheduleReconnect();
    },
    onWebSocketClose: () => {
      setStatus("disconnected");
      scheduleReconnect();
    },
  });
}

let reconnectTimer = null;
let reconnectAttempt = 0;

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempt, 15000);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    try {
      await connect();
    } catch {
      scheduleReconnect();
    }
  }, delay);
}

// Re-establishes every topic/user subscription a caller previously asked
// for — this is what makes reconnection invisible to the rest of the app:
// components never re-subscribe themselves, they just keep their handler
// registered and get events again once the socket is back.
function resubscribeAll() {
  reconnectAttempt = 0;
  for (const [destination, entry] of topicSubscriptions) {
    entry.sub = client.subscribe(destination, (message) => {
      const payload = safeParse(message.body);
      entry.handlers.forEach((fn) => fn(payload));
    });
  }
  if (userQueueHandlers.size > 0) {
    userQueueSub = client.subscribe("/user/queue/messaging.events", (message) => {
      const payload = safeParse(message.body);
      userQueueHandlers.forEach((fn) => fn(payload));
    });
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function connect() {
  if (currentStatus === "connected") return;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    setStatus("connecting");
    let token = getAccessToken();
    try {
      // A near-expired token used for CONNECT would leave the socket
      // authenticated only briefly — better to start with a fresh one.
      token = await refreshAccessToken();
    } catch {
      // Fall back to whatever's in storage; StompAuthChannelInterceptor
      // will simply reject an actually-invalid one and we'll retry.
    }
    if (!token) token = getAccessToken();
    if (!token) throw new Error("No access token available for messaging socket");

    if (client) {
      try { client.deactivate(); } catch { /* noop */ }
    }
    client = buildClient(token);
    client.activate();
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (client) {
    client.deactivate();
    client = null;
  }
  topicSubscriptions.clear();
  userQueueHandlers.clear();
  userQueueSub = null;
  setStatus("disconnected");
}

export function onConnectionStatus(fn) {
  connectionListeners.add(fn);
  fn(currentStatus);
  return () => connectionListeners.delete(fn);
}

// Subscribes to a conversation's live event topic. Returns an unsubscribe
// function. Safe to call before the socket is connected — the
// subscription is remembered and applied as soon as (re)connection
// happens.
export function subscribeToConversation(conversationId, handler) {
  const destination = `/topic/messaging.conversation.${conversationId}`;
  let entry = topicSubscriptions.get(destination);
  if (!entry) {
    entry = { sub: null, handlers: new Set() };
    topicSubscriptions.set(destination, entry);
    if (client && client.connected) {
      entry.sub = client.subscribe(destination, (message) => {
        const payload = safeParse(message.body);
        entry.handlers.forEach((fn) => fn(payload));
      });
    }
  }
  entry.handlers.add(handler);

  return () => {
    entry.handlers.delete(handler);
    if (entry.handlers.size === 0) {
      if (entry.sub) entry.sub.unsubscribe();
      topicSubscriptions.delete(destination);
    }
  };
}

// Subscribes to the caller's own personal event queue (new conversations,
// chat-list-level unread/presence updates that aren't tied to one open
// thread).
export function subscribeToUserQueue(handler) {
  userQueueHandlers.add(handler);
  if (client && client.connected && !userQueueSub) {
    userQueueSub = client.subscribe("/user/queue/messaging.events", (message) => {
      const payload = safeParse(message.body);
      userQueueHandlers.forEach((fn) => fn(payload));
    });
  }
  return () => {
    userQueueHandlers.delete(handler);
    if (userQueueHandlers.size === 0 && userQueueSub) {
      userQueueSub.unsubscribe();
      userQueueSub = null;
    }
  };
}

export function publish(destination, body) {
  if (!client || !client.connected) return;
  client.publish({ destination, body: JSON.stringify(body) });
}

export function sendTypingStart(conversationId) {
  publish("/app/typing.start", { conversationId });
}

export function sendTypingStop(conversationId) {
  publish("/app/typing.stop", { conversationId });
}

export function getStatus() {
  return currentStatus;
}