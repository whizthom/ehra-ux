import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBusinessType, setBusinessType } from "../api/businessApi";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import styles from "./BusinessSetup.module.css";

// Every business type the person can eventually pick between. Only RETAIL
// is actually live right now - everything else is a real roadmap item shown
// so people know it's coming, not a dead end. Keep this list in one place;
// both the grid and the "coming soon" modal read from it.
const BUSINESS_TYPES = [
  {
    key: "RETAIL",
    label: "Retail",
    icon: "ti-shopping-bag",
    tagline: "Live now",
    description:
      "Products, inventory, sales, customers, orders, expenses, suppliers and storefront tools.",
    available: true,
  },
  {
    key: "EDUCATION",
    label: "Education",
    icon: "ti-school",
    tagline: "Coming soon",
    description:
      "Students, classes, fees, attendance and staff built for schools and training centers.",
    available: false,
  },
  {
    key: "HOSPITALITY",
    label: "Hospitality & Hotel",
    icon: "ti-building-skyscraper",
    tagline: "Coming soon",
    description:
      "Rooms, bookings, guests, housekeeping and front-desk operations in one workspace.",
    available: false,
  },
  {
    key: "HEALTH",
    label: "Health Center",
    icon: "ti-stethoscope",
    tagline: "Coming soon",
    description:
      "Patients, appointments, records and billing for clinics and health centers.",
    available: false,
  },
];

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Which modal is open, if any: a "coming soon" notice keyed to the type
  // that was tapped, or the final "you can't undo this" confirmation for
  // Retail. Only one can be open at a time.
  const [soonType, setSoonType] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    getBusinessType()
      .then(({ data }) => setCurrent(data))
      .catch((e) =>
        setError(e?.response?.data?.message || "Could not load Business Type."),
      )
      .finally(() => setLoading(false));
  }, []);

  const handlePick = (type) => {
    if (saving) return;
    if (!type.available) {
      setSoonType(type);
      return;
    }
    setError("");
    setConfirmOpen(true);
  };

  const confirmRetail = async () => {
    setSaving(true);
    setError("");
    try {
      await setBusinessType("RETAIL", true);
      navigate("/retail", { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save Business Type.");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "ROLE_ADMIN") {
    return (
      <div className={styles.center}>
        Only a business owner can configure Business Type.
      </div>
    );
  }

  if (loading) {
    return <div className={styles.center}>Loading Business Type…</div>;
  }

  // ── Already locked in ────────────────────────────────────────────────
  if (current?.locked) {
    return (
      <div className={styles.wrap}>
        <span className={styles.orbA} aria-hidden="true" />
        <span className={styles.orbB} aria-hidden="true" />

        <div className={styles.page}>
          <header className={styles.top}>
            <Logo variant="horizontal" size={38} />
          </header>

          <div className={styles.intro}>
            <span className={styles.kicker}>Business Setup</span>
            <h1>Your Business Type is set</h1>
            <p>
              Business Type is permanent after confirmation, but you can still
              switch between the Generic Ehral Dashboard and your Business
              Workspace any time.
            </p>
          </div>

          <div className={styles.lockedCard}>
            <span className={styles.lockedIcon}>
              <i className="ti ti-check" aria-hidden="true" />
            </span>
            <h2>{current.label || "Retail"}</h2>
            <p>
              This business is configured as{" "}
              <strong>{current.label || "Retail"}</strong>. Head into the
              workspace to keep going, or return to your dashboard.
            </p>
            <div className={styles.lockedActions}>
              <button
                className={styles.primaryBtn}
                onClick={() => navigate("/retail")}
              >
                <i className="ti ti-arrow-right" aria-hidden="true" />
                Enter Retail Workspace
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => navigate("/dashboard")}
              >
                Back to Ehral Dashboard
              </button>
            </div>
          </div>

          <div className={styles.footer}>
            <Logo variant="horizontal" size={48} />
          </div>
        </div>
      </div>
    );
  }

  // ── Choosing a business type ────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <span className={styles.orbA} aria-hidden="true" />
      <span className={styles.orbB} aria-hidden="true" />

      <div className={styles.page}>
        <header className={styles.top}>
          <Logo variant="horizontal" size={38} />
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate("/dashboard")}
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
            <span>Not now</span>
          </button>
        </header>

        <div className={styles.intro}>
          <span className={styles.kicker}>Business Setup</span>
          <h1>Choose your business type</h1>
          <p>
            Your Business Type determines which specialized Business Workspace
            is available for this business. Your existing Ehral Dashboard will
            remain available either way.
          </p>
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.sectionHead}>
          <span>Available &amp; upcoming</span>
          <span className={styles.count}>
            <i className="ti ti-sparkles" aria-hidden="true" />
            More on the way
          </span>
        </div>

        <div className={styles.grid}>
          {BUSINESS_TYPES.map((type, i) => (
            <button
              key={type.key}
              type="button"
              className={`${styles.typeCard} ${type.available ? styles.available : styles.soon}`}
              style={{ "--i": i }}
              disabled={saving}
              onClick={() => handlePick(type)}
            >
              <span className={styles.typeIconWrap}>
                <i className={`ti ${type.icon}`} aria-hidden="true" />
              </span>
              <span className={styles.typeBody}>
                <span className={styles.typeName}>
                  {type.label}
                  <span
                    className={`${styles.badge} ${
                      type.available ? styles.availableBadge : styles.soonBadge
                    }`}
                  >
                    {type.available ? "Available" : "Coming soon"}
                  </span>
                </span>
                <p className={styles.typeDesc}>{type.description}</p>
              </span>
              <span className={styles.typeFooter}>
                <span className={styles.selectHint}>
                  {type.available ? "Select" : "Preview"}
                  <i className="ti ti-arrow-right" aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.warning}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>
            <strong>Important:</strong> once confirmed, your Business Type is
            permanent and can't be changed later. Review your selection before
            continuing.
          </span>
        </div>

        <div className={styles.footer}>
          <Logo variant="horizontal" size={48} />
        </div>
      </div>

      {/* ── "Coming soon" notice for any non-Retail type ── */}
      {soonType && (
        <div className={styles.modalOverlay} onClick={() => setSoonType(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.modalIcon} ${styles.soonIcon}`}>
              <i className={`ti ${soonType.icon}`} aria-hidden="true" />
            </div>
            <h3 className={styles.modalTitle}>
              {soonType.label} is coming soon
            </h3>
            <p className={styles.modalBody}>
              We're building a dedicated <strong>{soonType.label}</strong>{" "}
              workspace. It isn't available yet, but Retail is live today if
              you'd like to get started right away.
            </p>
            <div className={`${styles.modalActions} ${styles.single}`}>
              <button
                className={styles.confirmBtn}
                onClick={() => setSoonType(null)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Final, un-doable confirmation before locking in Retail ── */}
      {confirmOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => !saving && setConfirmOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <i className="ti ti-shopping-bag" aria-hidden="true" />
            </div>
            <h3 className={styles.modalTitle}>Confirm Retail?</h3>
            <p className={styles.modalBody}>
              You're about to set this business's type to{" "}
              <strong>Retail</strong>. Your Retail Workspace will be created and
              you'll be taken there right away.
            </p>
            <div className={styles.modalNote}>
              <i className="ti ti-lock" aria-hidden="true" />
              <span>
                This can't be changed later, so make sure Retail is right for
                this business.
              </span>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.confirmBtn}
                onClick={confirmRetail}
                disabled={saving}
              >
                {saving ? "Setting up…" : "Yes, confirm Retail"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
