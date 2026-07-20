import { createContext, useContext, useState, useCallback } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  switchContext as apiSwitchContext,
  clearTokens,
  saveSession,
  readSession,
  authRoleFor,
} from "../api/authApi";
import { completeProfile as apiCompleteProfile } from "../api/businessApi";
import { addBusiness as apiAddBusiness } from "../api/businessApi";

const AuthContext = createContext(null);

// Builds the shape the rest of the app reads `user` as. `role` stays in
// the pre-rebuild "ROLE_ADMIN" / "ROLE_EMPLOYEE" convention (ProtectedRoute,
// App.jsx route guards and a couple of components were written against
// that), derived from contextType rather than duplicated by hand.
// `membershipRole` carries the finer-grained backend value ("ADMIN" /
// "EMPLOYEE" / "HOD") for anything that cares about HOD specifically.
function userFromSession(session) {
  if (!session) return null;
  return {
    identityId: session.identityId,
    needsContextSelection: session.needsContextSelection,
    contextType: session.contextType, // "EMPLOYER" | "EMPLOYEE" | null
    businessId: session.businessId,
    membershipId: session.membershipId,
    membershipRole: session.role, // "ADMIN" | "EMPLOYEE" | "HOD" | null
    role: authRoleFor(session.contextType), // "ROLE_ADMIN" | "ROLE_EMPLOYEE" | null
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => userFromSession(readSession()));

  const login = useCallback(async (identifier, password) => {
    const data = await apiLogin(identifier, password);
    // requiresTwoFactor: no session was saved yet (see apiLogin) — nothing
    // to reflect into `user` until the OTP step completes and calls
    // refreshSession() below.
    if (!data.requiresTwoFactor) {
      setUser(userFromSession(readSession()));
    }
    return data;
  }, []);

  // Re-reads whatever's currently in localStorage into `user` — for flows
  // that persist a session themselves outside this context's own
  // login()/completeProfile()/etc. wrappers (phone registration via
  // phoneAuthApi.registerWithPhone, and the 2FA OTP step via
  // phoneAuthApi.verifyTwoFactorLogin), both of which call saveSession()
  // directly since they don't go through AuthContext.
  const refreshSession = useCallback(() => {
    setUser(userFromSession(readSession()));
  }, []);

  // Completes the new business's admin profile AND establishes a fresh
  // session for that business — mirrors login(), so the dashboard never
  // falls back to a stale session's tokens left over in localStorage.
  const completeProfile = useCallback(async (payload) => {
    const { data } = await apiCompleteProfile(payload);
    saveSession(data);
    setUser(userFromSession(readSession()));
    return data;
  }, []);

  // Switches the active workspace (business + role) for the CURRENT
  // Identity without a full re-login — see AuthController#switchContext.
  // type: "EMPLOYER" | "EMPLOYEE"; membershipId: one the Identity holds.
  const switchContext = useCallback(async (type, membershipId) => {
    const data = await apiSwitchContext(type, membershipId);
    setUser(userFromSession(readSession()));
    return data;
  }, []);

  // Creates a brand-new business under the CURRENTLY authenticated
  // Identity (My Accounts > "Create a business") and switches straight
  // into it — no new password, no new Identity.
  const addBusiness = useCallback(async (payload) => {
    const data = await apiAddBusiness(payload);
    saveSession(data);
    setUser(userFromSession(readSession()));
    return data;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const forceLogout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        refreshSession,
        completeProfile,
        switchContext,
        addBusiness,
        logout,
        forceLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
