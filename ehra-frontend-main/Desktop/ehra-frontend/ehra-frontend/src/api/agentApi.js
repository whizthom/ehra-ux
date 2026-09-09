import api from "./api";

const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_API_BASE_URL ||
  "https://ehral-agent-production.up.railway.app/api/v1";

const getAuthToken = () => {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    ""
  );
};

const buildHeaders = () => {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
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

/**
 * Send a conversational message to Ehral Intelligence.
 *
 * Compatible with:
 *   sendAgentMessage(message, conversationId)
 */
export async function sendAgentMessage(
  message,
  conversationId = null,
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
};

/**
 * Execute an Agent action after confirmation.
 */
export async function executeAgentAction(token) {
  return agentRequest("/actions/execute", {
    method: "POST",
    body: JSON.stringify({
      confirmation_token: token,
    }),
  });
};

/**
 * Fetch the Agent's business briefing.
 */
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
};

/**
 * Send voice/transcript input through the same Agent conversation path.
 */
export async function sendAgentVoice(formData) {
  const token = getAuthToken();

  return fetch(`${AGENT_BASE_URL}/agent/voice/chat`, {
    method: "POST",
    headers: {
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
};

/**
 * Generate an image through Ehral Intelligence.
 */
export async function generateAgentImage(payload) {
  return agentRequest("/agent/image", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export default {
  sendAgentMessage,
  executeAgentAction,
  fetchAgentBriefing,
  sendAgentVoice,
  generateAgentImage,
};