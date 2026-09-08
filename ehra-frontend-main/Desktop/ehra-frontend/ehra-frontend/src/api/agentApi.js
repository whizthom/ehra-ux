import axios from "axios";
import { getAccessToken, refreshAccessToken } from "./authApi";

// Same convention as authApi.js's API_BASE_URL: "/agent-api" is proxied to
// the Ehral Agent backend in dev (see vite.config.js); a production deploy
// sets VITE_AGENT_API_BASE_URL to wherever that service is actually
// running (it is a SEPARATE deployment from the Ehra backend — see
// ehral-agent/ARCHITECTURE.md).
export const AGENT_API_BASE_URL =
  import.meta.env.VITE_AGENT_API_BASE_URL || "/agent-api";

const agentClient = axios.create({
  baseURL: AGENT_API_BASE_URL,
  // Worst case a turn stacks a business-data tool call (Ehra-api,
  // EhralIntegration's own 15s timeout) followed by an AI provider call
  // (AI_REQUEST_TIMEOUT_SECONDS, 30s default) — up to ~45s before the
  // backend itself gives up, longer than the 15s used for ordinary CRUD
  // calls. 60s gives that a safety margin instead of racing it, so a
  // slow-but-legitimate turn doesn't surface as a misleading "check your
  // connection" network error.
  timeout: 60000,
});

// Every Ehral Agent request needs both an Authorization header (the
// SAME access token Ehra itself issues — the Agent verifies it directly,
// see ehral-agent's auth/jwt_verifier.py) and X-Application: "ehral" so
// the Agent knows which connected application's secret to verify it
// against. Read fresh on every request rather than once at import time,
// since refreshAccessToken() may have rotated it since the last call.
agentClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Application"] = "ehral";
  return config;
});

// A single-retry-after-refresh dance, deliberately simpler than
// authApi.js's own interceptor (no request queueing for concurrent
// calls) — the agent panel only ever has one in-flight request at a
// time (the send button is disabled while loading), so the added
// complexity of a shared queue isn't needed here.
let refreshing = null;

agentClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retried) {
      original._retried = true;
      try {
        refreshing = refreshing || refreshAccessToken();
        await refreshing;
        refreshing = null;
        return agentClient(original);
      } catch {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Sends one chat message and returns the Agent's reply. `conversationId`
 * is omitted on the first message of a session; the Agent creates one
 * and every subsequent call should pass it back to continue the same
 * thread (see ehral-agent's POST /api/v1/agent/chat contract).
 */
export async function sendAgentMessage(message, conversationId) {
  const { data } = await agentClient.post("/agent/chat", {
    message,
    conversation_id: conversationId || undefined,
  });
  return data;
}

/**
 * Confirms and executes a pending sensitive action (e.g. approving a
 * leave request) using the token the chat response returned in
 * `pending_confirmation.token`. This is a DELIBERATELY separate call
 * from sendAgentMessage — the chat endpoint itself can never execute a
 * mutation, only describe and offer to (see ehral-agent's Phase 4 design
 * notes); only this explicit call, backed by the person tapping
 * "Confirm", can.
 */
export async function executeAgentAction(confirmationToken) {
  const { data } = await agentClient.post("/actions/execute", {
    confirmation_token: confirmationToken,
  });
  return data;
}

/**
 * Optional: today's proactive briefing (greeting + insights). Used to
 * seed the panel with something useful the first time it's opened in a
 * session, before the person has typed anything. Failure here is
 * non-fatal — the panel still works as a plain chat if this fails, so
 * callers should swallow errors rather than blocking on it.
 */
export async function fetchAgentBriefing() {
  const { data } = await agentClient.get("/agent/briefing");
  return data;
}

export default agentClient;
