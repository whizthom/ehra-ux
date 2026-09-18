import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBusinessType, setBusinessType } from "../api/businessApi";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import styles from "./BusinessSetup.module.css";

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState("RETAIL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBusinessType()
      .then(({ data }) => setCurrent(data))
      .catch((e) => setError(e?.response?.data?.message || "Could not load Business Type."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (current?.locked) setSelected(current.businessType || "RETAIL");
  }, [current]);

  const confirm = async () => {
    setSaving(true);
    setError("");
    try {
      await setBusinessType(selected, true);
      navigate("/retail", { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save Business Type.");
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "ROLE_ADMIN") {
    return <div className={styles.center}>Only a business owner can configure Business Type.</div>;
  }

  if (loading) return <div className={styles.center}>Loading Business Type…</div>;

  if (current?.locked) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Logo variant="horizontal" size={58} />
          <div className={styles.icon}>✓</div>
          <h1>Business Type is locked</h1>
          <p>Your business is configured as <strong>{current.label || "Retail"}</strong>.</p>
          <p className={styles.muted}>Business Type is permanent after confirmation. You can still switch between the Generic Ehral Dashboard and your Business Workspace.</p>
          <button onClick={() => navigate("/retail")}>Enter Retail Workspace</button>
          <button className={styles.secondary} onClick={() => navigate("/dashboard")}>Back to Ehral Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo variant="horizontal" size={58} />
        <div className={styles.kicker}>BUSINESS SETUP</div>
        <h1>Choose Your Business Type</h1>
        <p className={styles.muted}>Your Business Type determines which specialized Business Workspace is available for this business. Your existing Ehral Dashboard will remain available.</p>

        <button
          className={`${styles.typeCard} ${selected === "RETAIL" ? styles.selected : ""}`}
          onClick={() => setSelected("RETAIL")}
        >
          <span className={styles.typeIcon}>🛍️</span>
          <span><strong>Retail</strong><small>Products, inventory, sales, customers, orders, expenses, suppliers and storefront tools.</small></span>
          <span className={styles.radio}>{selected === "RETAIL" ? "●" : "○"}</span>
        </button>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.warning}><strong>Important:</strong> Your Business Type is permanent after confirmation. Review your selection before continuing.</div>
        <button disabled={saving} onClick={confirm}>{saving ? "Saving…" : "Confirm Retail and Continue"}</button>
        <button className={styles.secondary} onClick={() => navigate("/dashboard")}>Not now</button>
      </div>
    </div>
  );
}
