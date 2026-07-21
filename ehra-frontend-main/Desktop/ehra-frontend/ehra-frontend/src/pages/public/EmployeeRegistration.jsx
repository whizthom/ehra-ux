import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { registerInvitedEmployee } from "../../api/invitationApi";
import styles from "./EmployeeRegistration.module.css";

const STEPS = [
  { title: "Personal information", sub: "Your name & date of birth" },
  { title: "Contact details", sub: "Email, phone & address" },
  { title: "Emergency contact", sub: "Who to reach in an emergency" },
  { title: "Account security", sub: "Set your password" },
];

const BLANK_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  phone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  password: "",
  confirmPassword: "",
};

export default function EmployeeRegistration() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Scoped per invite link, so switching between different invite emails
  // (or a colleague opening theirs on the same browser) never mixes drafts.
  // Password fields are deliberately left out of what gets saved — those
  // stay in memory only, and are re-typed if the tab is actually closed.
  const draftKey = `ehra_employee_reg_${token}`;

  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [step, setStep] = useState(() => loadDraft()?.step || 1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [form, setForm] = useState(() => ({
    ...BLANK_FORM,
    ...(loadDraft()?.form || {}),
  }));

  // Going "Back" between steps already preserves everything since `form`
  // lives in this single component — this just also survives a reload or
  // an accidental tab close midway through the invite link.
  useEffect(() => {
    try {
      const { password, confirmPassword, ...safeForm } = form;
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ step, form: safeForm }),
      );
    } catch {
      // sessionStorage unavailable — the in-page Back button still works fine.
    }
  }, [form, step, draftKey]);

  const handle = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const validate = () => {
    if (step === 1) {
      if (!form.firstName.trim()) return "First name is required.";
      if (!form.lastName.trim()) return "Last name is required.";
      if (!form.dateOfBirth) return "Date of birth is required.";
      if (!form.gender) return "Please select a gender.";
    }
    if (step === 2) {
      if (!form.email.trim()) return "Email address is required.";
      if (!form.phone.trim()) return "Phone number is required.";
      if (!form.address.trim()) return "Address is required.";
    }
    if (step === 3) {
      if (!form.emergencyContactName.trim())
        return "Emergency contact name is required.";
      if (!form.emergencyContactPhone.trim())
        return "Emergency contact phone is required.";
    }
    if (step === 4) {
      if (form.password.length < 8)
        return "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword)
        return "Passwords do not match.";
    }
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step < 4) {
      setStep((s) => s + 1);
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      await registerInvitedEmployee({ token, ...payload });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      navigate("/registration-submitted");
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Submission failed. Please try again.";
      setError(typeof msg === "string" ? msg : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const pwRules = [
    { label: "At least 8 characters", ok: form.password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(form.password) },
    { label: "One number", ok: /[0-9]/.test(form.password) },
  ];

  const progress = `${(step / 4) * 100}%`;

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <div className={styles.leftBody}>
          <span className={styles.tagline}>Employee registration</span>
          <h2 className={styles.headline}>Let's get you set up</h2>
          <p className={styles.desc}>
            Fill in your details to complete your profile and join your team.
          </p>

          <div className={styles.steps}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={n} className={styles.step}>
                  {n < 4 && <div className={styles.stepLine} />}
                  <div
                    className={`${styles.stepDot} ${done ? styles.dotDone : active ? styles.dotActive : styles.dotPending}`}
                  >
                    {done ? "✓" : n}
                  </div>
                  <div className={styles.stepBody}>
                    <p className={styles.stepLabel}>{s.title}</p>
                    <p className={styles.stepSub}>{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>
        <div className={styles.mobileHero}>
          <div className={styles.mobileDotGrid} aria-hidden="true" />
          <div className={styles.mobileLogoRow}>
            <div className={styles.mobileLogoIcon}>💼</div>
            <span className={styles.mobileLogoText}>Ehra</span>
          </div>
          <p className={styles.mobileEyebrow}>Employee registration</p>
          <h1 className={styles.mobileHeadline}>{STEPS[step - 1].title}</h1>

          <div className={styles.mobileSteps}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <span
                  key={n}
                  className={`${styles.mobileStepDot} ${done ? styles.mobileStepDone : ""} ${active ? styles.mobileStepActive : ""}`}
                  aria-label={s.title}
                />
              );
            })}
          </div>
        </div>

        {/* Header */}
        <div className={styles.rightHeader}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: progress }} />
          </div>
          <div className={styles.headerRow}>
            <span className={styles.stepTitle}>{STEPS[step - 1].title}</span>
            <span className={styles.stepCount}>Step {step} of 4</span>
          </div>
        </div>

        {/* Body */}
        <div className={styles.formBody}>
          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label>First name *</label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handle}
                    placeholder="Ada"
                  />
                </div>
                <div className={styles.field}>
                  <label>Last name *</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handle}
                    placeholder="Lovelace"
                  />
                </div>
              </div>
              <div className={styles.grid1}>
                <div className={styles.field}>
                  <label>
                    Middle name{" "}
                    <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    name="middleName"
                    value={form.middleName}
                    onChange={handle}
                    placeholder="Byron"
                  />
                </div>
                <div className={styles.field}>
                  <label>Date of birth *</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={handle}
                  />
                </div>
                <div className={styles.field}>
                  <label>Gender *</label>
                  <select name="gender" value={form.gender} onChange={handle}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className={styles.grid1}>
              <div className={styles.field}>
                <label>Email address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="ada@company.com"
                />
              </div>
              <div className={styles.field}>
                <label>Phone number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handle}
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className={styles.field}>
                <label>Home address *</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handle}
                  placeholder="123 Main St, Lagos"
                />
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <p className={styles.stepNote}>
                Provide details of someone we can contact on your behalf in case
                of an emergency.
              </p>
              <div className={styles.grid1}>
                <div className={styles.field}>
                  <label>Full name *</label>
                  <input
                    name="emergencyContactName"
                    value={form.emergencyContactName}
                    onChange={handle}
                    placeholder="Jane Lovelace"
                  />
                </div>
                <div className={styles.field}>
                  <label>Phone number *</label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={form.emergencyContactPhone}
                    onChange={handle}
                    placeholder="+234 800 000 0001"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <>
              <p className={styles.stepNote}>
                Choose a strong password to secure your Ehra account.
              </p>
              <div className={styles.grid1}>
                <div className={styles.field}>
                  <label>Password *</label>
                  <div className={styles.pwWrap}>
                    <input
                      type={showPw ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handle}
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      className={styles.pwToggle}
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Confirm password *</label>
                  <div className={styles.pwWrap}>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handle}
                      placeholder="Repeat your password"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.pwRules}>
                <p className={styles.pwRulesTitle}>Password requirements</p>
                {pwRules.map((r) => (
                  <div
                    key={r.label}
                    className={`${styles.pwRule} ${r.ok ? styles.pwRuleOk : ""}`}
                  >
                    <span>{r.ok ? "✓" : "○"}</span>
                    {r.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.formFooter}>
          {step > 1 && (
            <button
              type="button"
              className={styles.btnBack}
              onClick={() => {
                setStep((s) => s - 1);
                setError("");
              }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className={styles.btnNext}
            onClick={next}
            disabled={loading}
          >
            {loading
              ? "Submitting…"
              : step === 4
                ? "Submit registration"
                : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
