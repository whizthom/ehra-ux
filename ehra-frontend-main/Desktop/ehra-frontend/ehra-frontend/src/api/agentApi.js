import axios from "axios";
import { getAccessToken } from "./authApi";

const AGENT_API_BASE_URL =
  import.meta.env.VITE_AGENT_API_BASE_URL ||
  (import.meta.env.DEV
    ? "/agent-api"
    : "https://ehral-agent-production.up.railway.app/api/v1");

const agentClient = axios.create({
  baseURL: AGENT_API_BASE_URL,
  timeout: 60000,
});

agentClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function sendAgentMessage(message, conversationId = null) {
  const payload = {
    message,
  };

  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  const response = await agentClient.post("/agent/chat", payload);

  return response.data;
}

export async function fetchAgentBriefing(timezone = "UTC", locale = "en-US") {
  const response = await agentClient.get("/agent/briefing", {
    params: {
      timezone,
      locale,
    },
  });

  return response.data;
}

export async function executeAgentAction(confirmationToken) {
  const response = await agentClient.post("/actions/execute", {
    confirmation_token: confirmationToken,
  });

  return response.data;
}

export async function sendAgentVoiceMessage(audioFile, conversationId = null) {
  const formData = new FormData();

  formData.append("audio", audioFile);

  if (conversationId) {
    formData.append("conversation_id", conversationId);
  }

  const response = await agentClient.post("/agent/voice/chat", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export async function sendAgentImage(imageFile, message = "", conversationId = null) {
  const formData = new FormData();

  formData.append("image", imageFile);

  if (message) {
    formData.append("message", message);
  }

  if (conversationId) {
    formData.append("conversation_id", conversationId);
  }

  const response = await agentClient.post("/agent/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export default agentClient;