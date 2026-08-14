import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { connect, disconnect } from "../services/messagingSocket";

// Keeps the shared messaging WebSocket alive for as long as someone is
// logged in, and re-kicks it exactly when section 22 of the spec calls
// for: the tab becoming visible again after being backgrounded, and the
// browser regaining network connectivity after being offline. Mount this
// ONCE near the top of each dashboard (Dashboard.jsx / EmployeeDashboard.jsx)
// — every chat component below it just subscribes to the already-open
// socket via messagingSocket.js, they never open their own.
export default function useMessagingConnection() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    connect().catch(() => {
      // messagingSocket's own reconnect backoff takes over from here.
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") connect().catch(() => {});
    };
    const onOnline = () => connect().catch(() => {});

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisible);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) disconnect();
  }, [isAuthenticated]);
}