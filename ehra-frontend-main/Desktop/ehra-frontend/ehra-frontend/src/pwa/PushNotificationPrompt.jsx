import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getPermissionState,
  requestPermission,
  subscribe,
} from "../services/notificationService";

const DISMISSED_KEY = "ehral:pushPromptDismissed";

function wasDismissed(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export default function PushNotificationPrompt() {
  const { isAuthenticated, user } = useAuth();
  const dismissKey = `${DISMISSED_KEY}:${user?.identityId ?? "unknown"}`;
  const [status, setStatus] = useState(() => getPermissionState());
  const [dismissed, setDismissed] = useState(() => wasDismissed(dismissKey));
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated || status !== "default" || dismissed) return null;

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

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Still dismiss for this mounted session if storage is unavailable.
    }
    setDismissed(true);
  };

  return (
    <aside
      role="dialog"
      aria-label="Notification permission"
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
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        title="Not now"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          border: 0,
          background: "transparent",
          color: "inherit",
          fontSize: 20,
          lineHeight: 1,
          padding: 6,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      <strong>Stay updated with Ehral</strong>
      <p style={{ margin: "8px 0 12px", paddingRight: 20 }}>
        Get updates about messages, employee activity, and important account
        events.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          style={{
            border: "1px solid #ffffff66",
            borderRadius: 7,
            padding: "8px 12px",
            background: "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
