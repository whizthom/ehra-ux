import { getAccessToken } from "./authApi";

const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_API_BASE_URL ||
  (import.meta.env.DEV
    ? "/agent-api"
    : "https://ehral-agent-production.up.railway.app/api/v1");

const getAuthToken = () => {
  return getAccessToken() || "";
};

const buildHeaders = () => {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    "X-Application": "ehral",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const agentRequest = async (path, options = {}) => {
  const response = await fetch(`${AGENT_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      data?.error ||
      `Ehral Intelligence request failed (${response.status})`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
};

export async function fetchAgentConversation() {
  return agentRequest("/agent/conversation", {
    method: "GET",
  });
}

export async function sendAgentMessage(
  message,
  conversationId = null
) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const locale =
    navigator.language || "en-US";

  const payload = {
    message,
    timezone,
    locale,
  };

  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  return agentRequest("/agent/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function executeAgentAction(token) {
  return agentRequest("/actions/execute", {
    method: "POST",
    body: JSON.stringify({
      confirmation_token: token,
    }),
  });
}

export async function fetchAgentBriefing() {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const locale =
    navigator.language || "en-US";

  const params = new URLSearchParams({
    timezone,
    locale,
  });

  return agentRequest(`/agent/briefing?${params.toString()}`, {
    method: "GET",
  });
}

export async function sendAgentVoice(formData) {
  const token = getAuthToken();

  return fetch(`${AGENT_BASE_URL}/agent/voice/chat`, {
    method: "POST",
    headers: {
      "X-Application": "ehral",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  }).then(async (response) => {
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.detail ||
        data?.message ||
        data?.error ||
        `Voice request failed (${response.status})`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  });
}

export async function generateAgentImage(payload) {
  return agentRequest("/agent/image", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export default {
  sendAgentMessage,
  fetchAgentConversation,
  executeAgentAction,
  fetchAgentBriefing,
  sendAgentVoice,
  generateAgentImage,
};