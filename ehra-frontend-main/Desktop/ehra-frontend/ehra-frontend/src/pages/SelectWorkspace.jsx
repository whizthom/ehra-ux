import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/authApi";
import { logout as apiLogout } from "../api/authApi";
import styles from "./SelectWorkspace.module.css";
import Logo from "../components/Logo";

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

// Membership-type → display label. Explicit map instead of a binary
// ternary so a type nobody's handled yet shows something honest rather
// than silently being mislabeled. Kept in sync with the same map in
// MyAccountsPanel.jsx, which renders this identical list elsewhere.
const ROLE_LABEL = {
  EMPLOYER: "Owner · Admin",
  EMPLOYEE: "Employee",
};
function roleLabel(type) {
  return ROLE_LABEL[type] || type;
}

// Membership-type → post-switch destination. Customer memberships route to the dedicated customer dashboard.
function destinationFor(contextType) {
  if (contextType === "EMPLOYEE") return "/my-dashboard";
  if (contextType === "CUSTOMER") return "/customer-dashboard";
  return "/dashboard";
}

// Shown right after login when the authenticated Identity holds more than
// one membership and the session hasn't picked an active workspace yet
// (AuthResponseDTO.needsContextSelection === true). Also reachable any
// time from the "My Accounts" nav - this page and that panel share the
// same data (GET /api/auth/my-accounts) and the same switch action
// (POST /api/auth/context).
//
// One identity only ever has one customer account - it isn't tied to a
// specific business the way an EMPLOYER/EMPLOYEE membership is, so it
// doesn't belong in a list of "accounts to pick between". It gets its own
// standing entry point instead, separate from (and always above) the
// scrollable list of businesses below it.
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

  const businesses = accounts.filter((acc) => acc.type !== "CUSTOMER");
  const customerAccount = accounts.find((acc) => acc.type === "CUSTOMER");
  const customerEntry = customerAccount || {
    type: "CUSTOMER",
    membershipId: null,
    businessId: null,
    businessName: "Customer",
    businessLogo: null,
    role: "CUSTOMER",
    status: null,
    active: false,
    discovery: true,
  };
  const customerKey = customerEntry.membershipId ?? "CUSTOMER";

  const pick = async (acc) => {
    setSwitching(acc.membershipId ?? acc.type);
    setError("");
    try {
      const data = await switchContext(acc.type, acc.membershipId);
      navigate(destinationFor(data.contextType));
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
      <span className={styles.orbA} aria-hidden="true" />
      <span className={styles.orbB} aria-hidden="true" />

      <div className={styles.page}>
        <header className={styles.top}>
          <Logo variant="horizontal" size={38} />
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            <i className="ti ti-logout" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </header>

        <div className={styles.intro}>
          <span className={styles.kicker}>Welcome back</span>
          <h1>Where would you like to go?</h1>
          <p>
            Jump into your customer account, or pick a business you manage - you
            can always switch again later from My Accounts.
          </p>
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          className={styles.customerCard}
          disabled={switching !== null}
          onClick={() => pick(customerEntry)}
        >
          <span className={styles.customerIcon}>
            <i className="ti ti-compass" aria-hidden="true" />
          </span>
          <span className={styles.customerText}>
            <strong>Continue as customer</strong>
            <small>Browse, order from and message any business on Ehral</small>
          </span>
          {switching === customerKey ? (
            <span className={styles.itemSpinner} aria-hidden="true" />
          ) : (
            <i className="ti ti-arrow-right" aria-hidden="true" />
          )}
        </button>

        {loading ? (
          <div className={styles.skeletonGrid} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={styles.skeletonCard}
                style={{ "--i": i }}
              />
            ))}
          </div>
        ) : businesses.length > 0 ? (
          <>
            <div className={styles.sectionHead}>
              <span>Your businesses</span>
              <span className={styles.count}>{businesses.length}</span>
            </div>
            <div className={styles.listMask}>
              <div className={styles.list}>
                {businesses.map((acc, i) => (
                  <button
                    key={`${acc.type}-${acc.membershipId}`}
                    type="button"
                    className={styles.item}
                    style={{ "--i": i }}
                    disabled={switching !== null}
                    onClick={() => pick(acc)}
                  >
                    <span className={styles.avatar}>
                      {acc.businessLogo ? (
                        <img src={acc.businessLogo} alt="" />
                      ) : (
                        initials(acc.businessName)
                      )}
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemName}>
                        {acc.businessName}
                      </span>
                      <span className={styles.itemMeta}>
                        {roleLabel(acc.type)}
                        {acc.status && acc.status !== "ACTIVE"
                          ? ` · ${acc.status.replace("_", " ").toLowerCase()}`
                          : ""}
                      </span>
                    </span>
                    {switching === acc.membershipId ? (
                      <span className={styles.itemSpinner} aria-hidden="true" />
                    ) : (
                      <i
                        className={`ti ti-chevron-right ${styles.itemChevron}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <i className="ti ti-building-store" aria-hidden="true" />
            <p>You don't manage any businesses on Ehral yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
