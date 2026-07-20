import axios from "axios";

// In dev, "/api" is handled by the Vite proxy (see vite.config.js), which
// forwards to http://localhost:8080. In a production deploy (e.g. Render),
// the frontend and backend are on different origins, so VITE_API_BASE_URL
// should be set to the deployed backend's URL (e.g.
// "https://ehra-backend.onrender.com/api"). Falls back to "/api" so local
// dev behavior is unchanged when the env var isn't set.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15s — prevents requests from hanging forever on a
                   // dropped connection or a stalled token refresh.
});

// FIX: the /auth/refresh call MUST NOT go through the same `API` instance
// that the response interceptor below is attached to.
//
// Bug this fixes: if the refresh token itself is invalid/expired/revoked,
// POST /auth/refresh comes back 401. Issuing that call via `API` meant its
// 401 response re-entered this exact same response interceptor (since the
// interceptor runs for every request made through that instance, including
// ones the interceptor itself fires). Inside that re-entrant call, the
// refresh request looked like "just another request that needs refreshing"
// (its own `_retry` flag was unset), so it got pushed onto `failedQueue`
// and awaited a token that nothing would ever provide — `isRefreshing` was
// already `true`, so it queued instead of refreshing again, and the
// `await API.post("/auth/refresh", ...)` below never returned or threw.
// Net effect: the whole app silently hung forever the first time a refresh
// token was actually invalid (expired after a week, revoked by logging out
// elsewhere, etc.) — exactly the case that matters, since a healthy refresh
// token never hit this path at all.
//
// A plain axios instance with no interceptors can never re-trigger this
// logic, so its failures propagate as ordinary rejections.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// ── Session storage (Identity/Membership rebuild) ──────────────────────────
//
// Backend now returns AuthResponseDTO — no more "email"/"role" fields.
// Instead: identityId, needsContextSelection, contextType ("EMPLOYER" |
// "EMPLOYEE" | null), businessId, membershipId, role ("ADMIN" | "EMPLOYEE"
// | "HOD" | null). We persist all of it so a page refresh doesn't lose the
// active workspace, and derive a Spring-authority-shaped "authRole"
// ("ROLE_ADMIN" / "ROLE_EMPLOYEE") for the rest of the app (ProtectedRoute,
// role-gated UI) that was written against the old convention — the backend
// grants exactly those authorities for EMPLOYER / EMPLOYEE contexts (see
// JwtFilter#authoritiesFor), so this mapping is exact, not a guess.
export const getAccessToken = () => localStorage.getItem("accessToken");
export const getRefreshToken = () => localStorage.getItem("refreshToken");

export const authRoleFor = (contextType) => {
  if (contextType === "EMPLOYER") return "ROLE_ADMIN";
  if (contextType === "EMPLOYEE") return "ROLE_EMPLOYEE";
  return null;
};

export const saveTokens = ({ accessToken, refreshToken }) => {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
};

// Persists everything AuthResponseDTO carries about the session's identity
// and active workspace. Called after login, context-switch, complete-profile
// and refresh.
export const saveSession = (data) => {
  saveTokens(data);
  if (data.identityId != null) {
    localStorage.setItem("identityId", String(data.identityId));
  }
  localStorage.setItem(
    "needsContextSelection",
    data.needsContextSelection ? "1" : "0"
  );
  if (data.contextType) {
    localStorage.setItem("contextType", data.contextType);
  } else {
    localStorage.removeItem("contextType");
  }
  if (data.businessId != null) {
    localStorage.setItem("businessId", String(data.businessId));
  } else {
    localStorage.removeItem("businessId");
  }
  if (data.membershipId != null) {
    localStorage.setItem("membershipId", String(data.membershipId));
  } else {
    localStorage.removeItem("membershipId");
  }
  if (data.role) {
    localStorage.setItem("membershipRole", data.role);
  } else {
    localStorage.removeItem("membershipRole");
  }
};

export const readSession = () => {
  const identityId = localStorage.getItem("identityId");
  if (!identityId) return null;
  return {
    identityId,
    needsContextSelection: localStorage.getItem("needsContextSelection") === "1",
    contextType: localStorage.getItem("contextType") || null,
    businessId: localStorage.getItem("businessId") || null,
    membershipId: localStorage.getItem("membershipId") || null,
    role: localStorage.getItem("membershipRole") || null,
  };
};

export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("identityId");
  localStorage.removeItem("needsContextSelection");
  localStorage.removeItem("contextType");
  localStorage.removeItem("businessId");
  localStorage.removeItem("membershipId");
  localStorage.removeItem("membershipRole");
  // Legacy keys from the pre-Identity model — cleared too in case a tab
  // still has them from before this rebuild.
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userRole");
};

// Cross-tab sync: the `storage` event fires in every OTHER tab (never the
// tab that made the change) whenever localStorage is written. Without
// this, a tab sitting idle keeps using its in-memory copy of the access
// token until its own request fails — by which point another tab may
// already have rotated the refresh token, and the backend's grace window
// (see RefreshTokenServiceImpl) is the only thing saving it from being
// logged out. Picking up the new tokens here means an idle tab's next
// request just works, instead of relying on that grace window at all.
//
// If another tab logs out (clearTokens removes "refreshToken" without
// setting a new one), this tab follows it to /login too, rather than
// carrying on with tokens that no longer exist server-side.
window.addEventListener("storage", (event) => {
  if (event.key !== "accessToken" && event.key !== "refreshToken") return;

  const stillHasSession = localStorage.getItem("refreshToken");

  if (!stillHasSession && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
});

// Attach access token to every request
API.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) =>
    error ? p.reject(error) : p.resolve(token)
  );

  failedQueue = [];
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // If there's no config at all (e.g. the request timed out before it was
    // ever sent, or was cancelled), there's nothing to retry — reject immediately
    // instead of falling through and potentially hanging.
    if (!original) {
      return Promise.reject(error);
    }

    // FIX: Spring Security's default behavior for a stateless app with
    // .anyRequest().authenticated() is to treat a missing/expired token as
    // an "anonymous" principal rather than "no authentication at all" —
    // and an anonymous principal failing an authorization check comes back
    // as 403, not 401. In practice this meant every request made with an
    // expired access token (e.g. ~15 min after login) returned 403, this
    // branch never ran, and the user saw a generic "couldn't load data"
    // error instead of a silent, automatic refresh.
    //
    // The backend's SecurityConfig now installs a custom
    // AuthenticationEntryPoint so a genuinely unauthenticated request
    // returns a real 401. This 403 check stays as a second line of
    // defense — belt-and-suspenders for any endpoint or future code path
    // that ends up surfacing a 403 for an expired-token reason instead.
    //
    // This does NOT risk masking a real "you don't have permission" 403:
    // original._retry still bounds it to exactly one refresh-and-retry
    // attempt. If the role genuinely lacks access, the retried request
    // fails with 403 again, _retry is already true, and it falls through
    // to the final `return Promise.reject(error)` below and surfaces
    // normally — it isn't silently swallowed or retried forever.
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !original._retry
    ) {
      original._retry = true;

      if (isRefreshing) {
        // FIX: the previous `.catch(Promise.reject)` did not properly
        // propagate rejection in all environments and could leave queued
        // requests pending indefinitely if the in-flight refresh failed.
        // Using an explicit async/await + try/catch guarantees every
        // queued promise is settled one way or the other.
        try {
          const token = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          original.headers.Authorization = `Bearer ${token}`;
          return await API(original);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      isRefreshing = true;

      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await refreshClient.post("/auth/refresh", {
          refreshToken,
        });

        saveSession(data);

        original.headers.Authorization = `Bearer ${data.accessToken}`;

        processQueue(null, data.accessToken);

        return await API(original);
      } catch (err) {
        // Ensures every request queued behind this failed refresh is
        // rejected — not left hanging — so the UI can show an error
        // instead of spinning forever.
        processQueue(err, null);

        clearTokens();
        window.location.href = "/login";

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// identifier = email OR phone number — Identity supports dual-identifier
// login (see LoginRequestDTO / IdentityUserDetailsService).
//
// When the account has Two-Factor Authentication enabled, the backend
// returns { requiresTwoFactor: true, twoFactorToken } instead of real
// tokens — there is nothing to persist yet. The caller (Login.jsx) is
// responsible for collecting a fresh OTP and calling
// phoneAuthApi.verifyTwoFactorLogin(), which DOES save the session once
// it comes back with real tokens.
export const login = async (identifier, password) => {
  const { data } = await API.post("/auth/login", {
    identifier,
    password,
  });

  if (!data.requiresTwoFactor) {
    saveSession(data);
  }

  return data;
};

// Switches the session's active workspace (business + role) without a
// full re-login. `type` is "EMPLOYER" or "EMPLOYEE"; `membershipId` must
// be one the caller's Identity actually holds (the backend re-verifies
// this — see AuthController#switchContext).
export const switchContext = async (type, membershipId) => {
  const { data } = await API.post("/auth/context", { type, membershipId });
  saveSession(data);
  return data;
};

// Every workspace (business) the authenticated Identity currently holds a
// live membership at — powers the "My Accounts" nav section.
export const getMyAccounts = async () => {
  const { data } = await API.get("/auth/my-accounts");
  return data;
};

export const logout = async () => {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await API.post("/auth/logout", {
        refreshToken,
      });
    }
  } finally {
    clearTokens();
  }
};

export default API;
