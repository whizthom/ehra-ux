import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./CompleteProfile.module.css";

const STEP1_DRAFT_KEY = "ehra_signup_step1_draft";
const STEP2_DRAFT_KEY = "ehra_signup_step2_draft";

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STEP2_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSignupDrafts() {
  try {
    sessionStorage.removeItem(STEP1_DRAFT_KEY);
    sessionStorage.removeItem(STEP2_DRAFT_KEY);
  } catch {
    // ignore
  }
}

function initials(name) {
  return (
    name
      .split(" ")
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { completeProfile } = useAuth();

  const [form, setForm] = useState(
    () => loadDraft() || { name: "", phone: "" },
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Same draft-persistence approach as step 1 — so bouncing back and forth
  // between the two steps never costs the person their progress.
  useEffect(() => {
    try {
      sessionStorage.setItem(STEP2_DRAFT_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form]);

  const handle = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setLoading(true);
    try {
      const businessId = localStorage.getItem("businessId");
      const data = await completeProfile({
        businessId,
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      clearSignupDrafts();
      navigate(data.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard");
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.message ||
          data ||
          "Failed to complete profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Left ── */}
      <div className={styles.left}>
        <div className={styles.dotGrid} aria-hidden="true" />

        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>
        <div className={styles.leftBody}>
          <span className={styles.eyebrow}>Almost there</span>
          <h1 className={styles.headline}>
            One last step before your dashboard
          </h1>
          <p className={styles.desc}>
            Tell us about the admin who'll be managing this workspace.
          </p>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepLine} />
              <div className={`${styles.stepDot} ${styles.dotDone}`}>
                <i className="ti ti-check" />
              </div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Account created</p>
                <p className={styles.stepSub}>
                  Business name, email & password
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={`${styles.stepDot} ${styles.dotActive}`}>2</div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Complete your profile</p>
                <p className={styles.stepSub}>Your name & contact number</p>
              </div>
            </div>
          </div>
        </div>
        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right ── */}
      <div className={styles.right}>
        <div className={styles.rightHeader}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => navigate("/")}
          >
            <i className="ti ti-arrow-left" />
            Back to account details
          </button>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "100%" }} />
          </div>
          <div className={styles.headerRow}>
            <span className={styles.stepTitle}>Complete your profile</span>
            <span className={styles.stepCount}>Step 2 of 2</span>
          </div>
        </div>

        <div className={styles.formBody}>
          {error && (
            <div className={styles.errorBox} role="alert">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          {/* Live avatar preview */}
          <div className={styles.avatarRow}>
            <div className={styles.avatarCircle}>
              {form.name.trim() ? initials(form.name) : "?"}
            </div>
            <div className={styles.avatarInfo}>
              <p>{form.name.trim() || "Your name will appear here"}</p>
              <span>Workspace administrator</span>
            </div>
          </div>

          <div className={styles.field}>
            <label>Full name</label>
            <div className={styles.inputWrap}>
              <i className={`ti ti-user ${styles.prefix}`} />
              <input
                name="name"
                type="text"
                placeholder="Ada Lovelace"
                value={form.name}
                onChange={handle}
                onKeyDown={(e) =>
                  e.key === "Enter" && document.getElementById("phone").focus()
                }
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Phone number</label>
            <div className={styles.inputWrap}>
              <i className={`ti ti-phone ${styles.prefix}`} />
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={form.phone}
                onChange={handle}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <span className={styles.hint}>
              Used for account verification and urgent notifications only.
            </span>
          </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Saving…" : "Go to dashboard"}
            {!loading && <i className="ti ti-arrow-right" />}
          </button>
        </div>
      </div>
    </div>
  );
}
