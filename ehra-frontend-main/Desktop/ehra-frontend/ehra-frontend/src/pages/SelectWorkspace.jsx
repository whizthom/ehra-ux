import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/authApi";
import { logout as apiLogout } from "../api/authApi";
import styles from "./SelectWorkspace.module.css";

function initials(name) {
  return (
    (name || "")
      .split(" ")
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Shown right after login when the authenticated Identity holds more than
// one membership and the session hasn't picked an active workspace yet
// (AuthResponseDTO.needsContextSelection === true). Also reachable any
// time from the "My Accounts" nav — this page and that panel share the
// same data (GET /api/auth/my-accounts) and the same switch action
// (POST /api/auth/context).
export default function SelectWorkspace() {
  const { switchContext } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    getMyAccounts()
      .then(setAccounts)
      .catch(() => setError("Couldn't load your accounts. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const pick = async (acc) => {
    setSwitching(acc.membershipId);
    setError("");
    try {
      const data = await switchContext(acc.type, acc.membershipId);
      navigate(
        data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard",
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Couldn't switch to that workspace.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
      setSwitching(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      navigate("/login");
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <h1 className={styles.title}>Choose a workspace</h1>
        <p className={styles.subtitle}>
          You're connected to more than one business. Pick where you want to go
          — you can switch anytime from My Accounts.
        </p>

        {error && (
          <div className={styles.errorBox} role="alert">
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            <span>Loading your accounts…</span>
          </div>
        ) : (
          <div className={styles.list}>
            {accounts.map((acc) => (
              <button
                key={`${acc.type}-${acc.membershipId}`}
                type="button"
                className={styles.item}
                disabled={switching !== null}
                onClick={() => pick(acc)}
              >
                <div className={styles.avatar}>
                  {acc.businessLogo ? (
                    <img src={acc.businessLogo} alt="" />
                  ) : (
                    initials(acc.businessName)
                  )}
                </div>
                <div className={styles.itemBody}>
                  <span className={styles.itemName}>{acc.businessName}</span>
                  <span className={styles.itemMeta}>
                    {acc.type === "EMPLOYER" ? "Owner · Admin" : "Employee"}
                    {acc.status && acc.status !== "ACTIVE"
                      ? ` · ${acc.status.replace("_", " ").toLowerCase()}`
                      : ""}
                  </span>
                </div>
                {switching === acc.membershipId ? (
                  <span className={styles.itemSpinner} />
                ) : (
                  <i className={`ti ti-chevron-right ${styles.itemChevron}`} />
                )}
              </button>
            ))}

            {accounts.length === 0 && !loading && (
              <p className={styles.empty}>
                You don't currently have any active business memberships.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.logoutLink}
          onClick={handleLogout}
        >
          <i className="ti ti-logout" />
          Log out
        </button>
      </div>
    </div>
  );
}
