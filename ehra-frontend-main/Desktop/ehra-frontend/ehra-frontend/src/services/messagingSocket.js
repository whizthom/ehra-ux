import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs.js";
import {
  getAccessToken,
  refreshAccessToken,
  API_BASE_URL,
} from "../api/authApi";

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

const WS_URL =
  (API_BASE_URL.startsWith("http")
    ? API_BASE_URL.replace(/\/api\/?$/, "")
    : "") + "/ws-messaging";

let client = null;
let connectPromise = null;

const topicSubscriptions = new Map();
// destination -> { sub, handlers: Set }

let userQueueSub = null;
const userQueueHandlers = new Set();

const connectionListeners = new Set();

let currentStatus = "disconnected";
// "connecting" | "connected" | "disconnected"

function setStatus(status) {
  currentStatus = status;

  connectionListeners.forEach((fn) => fn(status));
}

function buildClient(token) {
  return new Client({
    webSocketFactory: () => new SockJS(WS_URL),

    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },

    reconnectDelay: 0,
    // We drive reconnection ourselves so we can refresh the token first.

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

  const delay = Math.min(
    1000 * 2 ** reconnectAttempt,
    15000
  );

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

// Re-establish every topic/user subscription a caller previously asked
// for. This makes reconnection invisible to the rest of the app:
// components never need to re-subscribe themselves.

function resubscribeAll() {
  reconnectAttempt = 0;

  for (const [destination, entry] of topicSubscriptions) {
    entry.sub = client.subscribe(destination, (message) => {
      const payload = safeParse(message.body);

      entry.handlers.forEach((fn) => fn(payload));
    });
  }

  if (userQueueHandlers.size > 0) {
    userQueueSub = client.subscribe(
      "/user/queue/messaging.events",
      (message) => {
        const payload = safeParse(message.body);

        userQueueHandlers.forEach((fn) => fn(payload));
      }
    );
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Establish the shared messaging connection.
 */
export async function connect() {
  if (currentStatus === "connected") {
    return;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    setStatus("connecting");

    let token = getAccessToken();

    try {
      // Start with a fresh token where possible.
      token = await refreshAccessToken();
    } catch {
      // Fall back to the token already in storage.
    }

    if (!token) {
      token = getAccessToken();
    }

    if (!token) {
      throw new Error(
        "No access token available for messaging socket"
      );
    }

    if (client) {
      try {
        client.deactivate();
      } catch {
        // noop
      }
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

/**
 * Disconnect the shared messaging socket.
 *
 * IMPORTANT:
 * This is a named export because AuthContext.jsx and
 * useMessagingConnection.js import it directly.
 */
export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

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

/**
 * Listen for connection status changes.
 */
export function onConnectionStatus(fn) {
  connectionListeners.add(fn);

  fn(currentStatus);

  return () => connectionListeners.delete(fn);
}

/**
 * Subscribe to a conversation's live event topic.
 */
export function subscribeToConversation(
  conversationId,
  handler
) {
  const destination =
    `/topic/messaging.conversation.${conversationId}`;

  let entry = topicSubscriptions.get(destination);

  if (!entry) {
    entry = {
      sub: null,
      handlers: new Set(),
    };

    topicSubscriptions.set(destination, entry);

    if (client && client.connected) {
      entry.sub = client.subscribe(
        destination,
        (message) => {
          const payload = safeParse(message.body);

          entry.handlers.forEach((fn) => fn(payload));
        }
      );
    }
  }

  entry.handlers.add(handler);

  return () => {
    entry.handlers.delete(handler);

    if (entry.handlers.size === 0) {
      if (entry.sub) {
        entry.sub.unsubscribe();
      }

      topicSubscriptions.delete(destination);
    }
  };
}

/**
 * Subscribe to the current user's personal event queue.
 *
 * IMPORTANT:
 * This is a named export because
 * useMessagingBadgeSync.js and useConversations.js
 * import it directly.
 */
export function subscribeToUserQueue(handler) {
  userQueueHandlers.add(handler);

  if (
    client &&
    client.connected &&
    !userQueueSub
  ) {
    userQueueSub = client.subscribe(
      "/user/queue/messaging.events",
      (message) => {
        const payload = safeParse(message.body);

        userQueueHandlers.forEach((fn) => fn(payload));
      }
    );
  }

  return () => {
    userQueueHandlers.delete(handler);

    if (
      userQueueHandlers.size === 0 &&
      userQueueSub
    ) {
      userQueueSub.unsubscribe();
      userQueueSub = null;
    }
  };
}

/**
 * Publish a STOMP message.
 */
export function publish(destination, body) {
  if (!client || !client.connected) {
    return;
  }

  client.publish({
    destination,
    body: JSON.stringify(body),
  });
}

/**
 * Notify the backend that the user started typing.
 */
export function sendTypingStart(conversationId) {
  publish("/app/typing.start", {
    conversationId,
  });
}

/**
 * Notify the backend that the user stopped typing.
 */
export function sendTypingStop(conversationId) {
  publish("/app/typing.stop", {
    conversationId,
  });
}

/**
 * Return the current connection status.
 */
export function getStatus() {
  return currentStatus;
}