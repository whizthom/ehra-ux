import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/authApi";
import styles from "./MyAccountsPanel.module.css";

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

const BLANK_BUSINESS = { name: "", email: "", phone: "", address: "" };

// The "My Accounts" nav feature — every workspace (business) the logged-in
// Identity currently holds a membership at, either as owner (EMPLOYER) or
// as staff (EMPLOYEE). Lets the person switch between them without
// logging out, and start a brand-new business under the same Identity
// (an employee going into business for themselves, or an owner adding a
// second business). Rendered as a modal from both Dashboard and
// EmployeeDashboard so it's reachable from whichever workspace the
// person is currently in.
export default function MyAccountsPanel({ open, onClose }) {
  const { switchContext, addBusiness } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_BUSINESS);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    getMyAccounts()
      .then(setAccounts)
      .catch(() => setError("Couldn't load your accounts. Please try again."))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const pick = async (acc) => {
    if (acc.active) {
      onClose();
      return;
    }
    setSwitchingId(acc.membershipId);
    setError("");
    try {
      const data = await switchContext(acc.type, acc.membershipId);
      onClose();
      navigate(data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.message || "Couldn't switch to that workspace.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!form.name.trim()) {
      setCreateError("Business name is required.");
      return;
    }
    if (!form.email.trim()) {
      setCreateError("Business email is required.");
      return;
    }
    setCreating(true);
    try {
      const data = await addBusiness({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setForm(BLANK_BUSINESS);
      setShowCreate(false);
      onClose();
      navigate(data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard");
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.errors ? Object.values(data.errors)[0] : data?.message || data;
      setCreateError(typeof msg === "string" ? msg : "Failed to create business.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>My accounts</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          {!showCreate && (
            <>
              <p className={styles.hint}>
                Switch between every business you own or work for — all
                under this one login.
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
                  <span>Loading…</span>
                </div>
              ) : (
                <div className={styles.list}>
                  {accounts.map((acc) => (
                    <button
                      key={`${acc.type}-${acc.membershipId}`}
                      type="button"
                      className={`${styles.item} ${acc.active ? styles.itemActive : ""}`}
                      disabled={switchingId !== null}
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
                      {acc.active ? (
                        <span className={styles.activeBadge}>Current</span>
                      ) : switchingId === acc.membershipId ? (
                        <span className={styles.spinner} />
                      ) : (
                        <i className={`ti ti-chevron-right ${styles.itemChevron}`} />
                      )}
                    </button>
                  ))}

                  {accounts.length === 0 && (
                    <p className={styles.empty}>No accounts found.</p>
                  )}
                </div>
              )}

              <button
                type="button"
                className={styles.createTrigger}
                onClick={() => setShowCreate(true)}
              >
                <i className="ti ti-plus" />
                Create a business under this account
              </button>
            </>
          )}

          {showCreate && (
            <>
              <button
                type="button"
                className={styles.backLink}
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
              >
                <i className="ti ti-arrow-left" /> Back to accounts
              </button>

              <p className={styles.hint}>
                This creates a new, separate business — you'll be its
                owner, and it stays fully independent from any other
                business you're connected to.
              </p>

              {createError && (
                <div className={styles.errorBox} role="alert">
                  <i className="ti ti-alert-circle" />
                  <span>{createError}</span>
                </div>
              )}

              <div className={styles.field}>
                <label>Business name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className={styles.field}>
                <label>Business email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="hello@acme.com"
                />
              </div>
              <div className={styles.field}>
                <label>
                  Phone <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className={styles.field}>
                <label>
                  Address <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, Lagos"
                />
              </div>
            </>
          )}
        </div>

        {showCreate && (
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.createBtn}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create business"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
