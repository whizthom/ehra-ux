import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getPermissionState,
  requestPermission,
  subscribe,
} from "../services/notificationService";

export default function PushNotificationPrompt() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(() => getPermissionState());
  const [busy, setBusy] = useState(false);
  if (!isAuthenticated || status !== "default") return null;

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await requestPermission();
      setStatus(permission);
      if (permission === "granted") await subscribe();
    } catch {
      // Keep the prompt available; a later user action can retry safely.
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 2000,
        maxWidth: 340,
        padding: 16,
        borderRadius: 12,
        background: "#18352f",
        color: "white",
        boxShadow: "0 8px 28px #0004",
      }}
    >
      <strong>Stay updated with Ehral</strong>
      <p style={{ margin: "8px 0 12px" }}>
        Get updates about messages, employee activity, and important account
        events.
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        style={{
          border: 0,
          borderRadius: 7,
          padding: "8px 12px",
          cursor: "pointer",
        }}
      >
        {busy ? "Enabling…" : "Enable notifications"}
      </button>
    </aside>
  );
}
