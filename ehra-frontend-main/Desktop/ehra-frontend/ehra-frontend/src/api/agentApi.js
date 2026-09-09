import api from "./authApi";

/**
 * Ehral Intelligence API
 *
 * Employer-only Agent client.
 *
 * The backend remains the final authority for authorization.
 * The frontend should never assume that hiding the Agent is sufficient
 * protection.
 */

const AGENT_BASE = "/agent";

/**
 * Send a message to Ehral Intelligence.
 *
 * @param {Object} payload
 * @param {string} payload.message
 * @param {Array} [payload.history]
 * @param {string} [payload.timezone]
 * @param {string} [payload.locale]
 * @returns {Promise<Object>}
 */
export async function sendAgentMessage({
  message,
  history = [],
  timezone,
  locale,
}) {
  const response = await api.post(`${AGENT_BASE}/chat`, {
    message,
    history,
    timezone:
      timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
    locale:
      locale ||
      navigator.language ||
      "en",
  });

  return response.data;
}

/**
 * Retrieve the employer's Agent briefing.
 *
 * @param {Object} [options]
 * @param {string} [options.timezone]
 * @param {string} [options.locale]
 * @returns {Promise<Object>}
 */
export async function getAgentBriefing({
  timezone,
  locale,
} = {}) {
  const params = new URLSearchParams();

  params.set(
    "timezone",
    timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
  );

  params.set(
    "locale",
    locale ||
      navigator.language ||
      "en",
  );

  const response = await api.get(
    `${AGENT_BASE}/briefing?${params.toString()}`,
  );

  return response.data;
}

/**
 * Execute an approved Agent action.
 *
 * This should only be called after the UI has received an explicit
 * confirmation from the employer.
 *
 * @param {Object} action
 * @returns {Promise<Object>}
 */
export async function executeAgentAction(action) {
  const response = await api.post(
    `${AGENT_BASE}/actions/execute`,
    action,
  );

  return response.data;
}

/**
 * Send audio to Ehral Intelligence.
 *
 * @param {FormData} formData
 * @returns {Promise<Object>}
 */
export async function sendAgentVoice(formData) {
  const response = await api.post(
    `${AGENT_BASE}/voice/chat`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

/**
 * Generate an image through Ehral Intelligence.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function generateAgentImage(payload) {
  const response = await api.post(
    `${AGENT_BASE}/image`,
    payload,
  );

  return response.data;
}

/**
 * Safely determine whether an API error means the current account
 * is not authorized to use Ehral Intelligence.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAgentForbiddenError(error) {
  return error?.response?.status === 403;
}

/**
 * Safely determine whether the Agent service is temporarily unavailable.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAgentUnavailableError(error) {
  const status = error?.response?.status;

  return (
    status === 502 ||
    status === 503 ||
    status === 504
  );
}