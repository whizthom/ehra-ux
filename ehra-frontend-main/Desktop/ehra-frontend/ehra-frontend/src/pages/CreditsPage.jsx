import { useNavigate } from "react-router-dom";
import EhralCredits from "./EhralCredits";

/** Standalone Credits page for non-retail (GENERAL) business owners; Retail keeps its workspace tab. */
export default function CreditsPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: 0, color: "var(--text-secondary)", cursor: "pointer", font: "inherit", marginBottom: 8 }}
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> Back to dashboard
      </button>
      <EhralCredits />
    </div>
  );
}
