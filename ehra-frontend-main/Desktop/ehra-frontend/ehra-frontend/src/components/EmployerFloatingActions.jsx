import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBusinessType } from "../api/businessApi";
import { useAuth } from "../context/AuthContext";
import AiAgentWidget from "./agent/AiAgentWidget";
import styles from "./EmployerFloatingActions.module.css";

/**
 * Persistent employer-only controls.
 *
 * These controls deliberately live at the application shell level rather than
 * inside an individual dashboard page. That keeps the dashboard switch and
 * Ehral Intelligence available while an employer moves between the generic
 * dashboard, Retail Workspace, My Accounts, Support, and other employer-only
 * routes without duplicating navigation controls in each page.
 */
export default function EmployerFloatingActions() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [loadingBusinessType, setLoadingBusinessType] = useState(false);

  const isEmployer = user?.role === "ROLE_ADMIN";

  useEffect(() => {
    if (!isEmployer) {
      setBusinessType(null);
      return undefined;
    }

    let cancelled = false;
    setLoadingBusinessType(true);

    getBusinessType()
      .then(({ data }) => {
        if (!cancelled) setBusinessType(data || null);
      })
      .catch(() => {
        if (!cancelled) setBusinessType(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBusinessType(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEmployer, user?.businessId, user?.membershipId]);

  useEffect(() => {
    if (!agentOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setAgentOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [agentOpen]);

  if (!isEmployer) return null;

  const inBusinessWorkspace =
    location.pathname === "/retail" || location.pathname.startsWith("/retail/");
  const inBusinessSetup = location.pathname === "/business-setup";
  const businessWorkspaceReady = businessType?.businessType === "RETAIL";

  const switchDashboard = () => {
    if (inBusinessWorkspace || inBusinessSetup) {
      navigate("/dashboard");
      return;
    }

    if (businessWorkspaceReady) {
      navigate("/retail");
      return;
    }

    navigate("/business-setup");
  };

  const switchLabel =
    inBusinessWorkspace || inBusinessSetup
      ? "Switch to Ehral Dashboard"
      : businessWorkspaceReady
        ? "Switch to Retail Workspace"
        : "Set up Business Workspace";

  return (
    <>
      <div className={styles.stack} aria-label="Ehral employer tools">
        <button
          type="button"
          className={`${styles.action} ${styles.aiAction}`}
          onClick={() => setAgentOpen(true)}
          aria-label="Open Ehral Intelligence"
          title="Ehral Intelligence"
        >
          <i className="ti ti-sparkles" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.switchAction}`}
          onClick={switchDashboard}
          disabled={loadingBusinessType && !inBusinessWorkspace}
          aria-label={switchLabel}
          title={switchLabel}
        >
          <i className="ti ti-switch-horizontal" aria-hidden="true" />
        </button>
      </div>

      {agentOpen && (
        <div
          className={styles.agentOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Ehral Intelligence"
        >
          <AiAgentWidget fullPage onClose={() => setAgentOpen(false)} />
        </div>
      )}
    </>
  );
}
