import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs.js";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  `${window.location.origin}/ws`;

let stompClient = null;

export const connectMessagingSocket = ({
  token,
  onConnect,
  onMessage,
  onError,
} = {}) => {
  if (stompClient?.active) {
    return stompClient;
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),

    connectHeaders: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},

    reconnectDelay: 5000,

    onConnect: (frame) => {
      if (typeof onConnect === "function") {
        onConnect(frame);
      }
    },

    onStompError: (frame) => {
      console.error("STOMP error:", frame);

      if (typeof onError === "function") {
        onError(frame);
      }
    },

    onWebSocketError: (error) => {
      console.error("WebSocket error:", error);

      if (typeof onError === "function") {
        onError(error);
      }
    },
  });

  if (typeof onMessage === "function") {
    stompClient.onUnhandledMessage = onMessage;
  }

  stompClient.activate();

  return stompClient;
};

export const subscribeToMessagingTopic = (
  destination,
  callback
) => {
  if (!stompClient?.active) {
    console.warn(
      "Messaging socket is not connected. Cannot subscribe yet."
    );
    return null;
  }

  return stompClient.subscribe(destination, (message) => {
    try {
      const payload = JSON.parse(message.body);

      if (typeof callback === "function") {
        callback(payload, message);
      }
    } catch (error) {
      console.error(
        "Failed to parse messaging socket message:",
        error
      );

      if (typeof callback === "function") {
        callback(message.body, message);
      }
    }
  });
};

export const disconnectMessagingSocket = async () => {
  if (!stompClient) {
    return;
  }

  await stompClient.deactivate();
  stompClient = null;
};

export const getMessagingSocket = () => stompClient;

export default {
  connectMessagingSocket,
  subscribeToMessagingTopic,
  disconnectMessagingSocket,
  getMessagingSocket,
};