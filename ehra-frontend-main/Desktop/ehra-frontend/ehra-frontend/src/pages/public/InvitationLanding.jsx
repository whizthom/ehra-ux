import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { validateInvitation, acceptInvitation } from "../../api/invitationApi";
import styles from "./InvitationLanding.module.css";

// Key used to remember an invite token across a trip to /login, so
// someone who gets an invite link while logged out lands right back here
// — with their session now attached — instead of losing the invite.
const PENDING_INVITE_KEY = "ehra_pending_invite";

export default function InvitationLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [businessName, setBusinessName] = useState("");

  // Authenticated-accept flow state (existing Identity — a business owner
  // picking up part-time work, or anyone already on Ehra being invited to
  // a second business). Kept separate from the anonymous /register/:token
  // flow, which creates a brand-new Identity.
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    validateInvitation(token)
      .then((data) => {
        setValid(data.valid);
        setBusinessName(data.businessName);
      })
      .catch(() => setValid(false))
      .finally(() => setLoading(false));
  }, [token]);

  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Existing Identity, already logged in: attach this invite to the
  // account they're currently signed into — no new password, no new
  // Identity. Lands as a PENDING_APPROVAL membership the business owner
  // still has to approve; shows up right away in "My Accounts".
  const handleAcceptAsSelf = async () => {
    setAcceptError("");
    setAccepting(true);
    try {
      await acceptInvitation(token);
      setAccepted(true);
    } catch (err) {
      const data = err?.response?.data;
      const msg = data?.message || data;
      setAcceptError(
        typeof msg === "string" ? msg : "Couldn't accept this invitation. Please try again."
      );
    } finally {
      setAccepting(false);
    }
  };

  // No session yet: remember the invite, then send them to log in with an
  // existing Ehra account (Login.jsx checks for this key after a
  // successful login and bounces straight back here).
  const handleLoginInstead = () => {
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
    navigate("/login");
  };

  return (
    <div className={styles.page}>

      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>
        <div className={styles.leftBody}>
          <span className={styles.tagline}>HR Management</span>
          <h2 className={styles.headline}>
            You've been invited to join a workspace
          </h2>
          <p className={styles.desc}>
            Accept the invitation to connect with your team and start managing
            your HR experience.
          </p>
          <div className={styles.pills}>
            <div className={styles.pill}>🔒 Secure & encrypted onboarding</div>
            <div className={styles.pill}>👥 Join your team instantly</div>
            <div className={styles.pill}>⏱ Takes less than 2 minutes</div>
          </div>
        </div>
        <p className={styles.leftFooter}>© 2025 Ehra. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.right}>

        {/* Loading */}
        {loading && (
          <div className={styles.state}>
            <div className={styles.spinnerWrap}>
              <span className={styles.spinner} />
            </div>
            <p className={styles.stateTitle}>Verifying invitation</p>
            <p className={styles.stateSub}>
              Please wait while we validate your invitation link…
            </p>
          </div>
        )}

        {/* Invalid */}
        {!loading && !valid && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconDanger}`}>
              🔗
            </div>
            <p className={styles.stateTitle}>Invitation unavailable</p>
            <p className={styles.stateSub}>
              This invitation link is invalid or has expired. Please contact
              your HR administrator for a new one.
            </p>
          </div>
        )}

        {/* Accepted (authenticated flow) */}
        {!loading && valid && isAuthenticated && accepted && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
              ✅
            </div>
            <p className={styles.stateTitle}>Invitation accepted</p>
            <p className={styles.stateSub}>
              {businessName} still needs to approve your membership. Once
              approved, this workspace will appear under My Accounts and
              you can switch into it any time.
            </p>
            <button
              className={styles.acceptBtn}
              onClick={() =>
                navigate(user?.contextType === "EMPLOYEE" ? "/my-dashboard" : "/dashboard")
              }
            >
              Go to my accounts →
            </button>
          </div>
        )}

        {/* Valid, authenticated, not yet accepted — accept onto the
            existing Identity rather than the anonymous sign-up form. */}
        {!loading && valid && isAuthenticated && !accepted && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
              ✉️
            </div>
            <p className={styles.stateTitle}>You've been invited</p>
            <p className={styles.stateSub}>
              {businessName} has invited you to join as an employee. You're
              already signed in to Ehra — accept below to add this
              workspace to your account.
            </p>

            <div className={styles.orgCard}>
              <div className={styles.orgAvatar}>{initials}</div>
              <div>
                <p className={styles.orgName}>{businessName}</p>
                <p className={styles.orgLabel}>Invited organisation</p>
              </div>
            </div>

            {acceptError && (
              <div className={styles.notice}>
                <span>⚠️</span>
                <p>{acceptError}</p>
              </div>
            )}

            <div className={styles.notice}>
              <span>ℹ️</span>
              <p>
                This adds a new workspace to your existing account — your
                other businesses stay exactly as they are.
              </p>
            </div>

            <button
              className={styles.acceptBtn}
              onClick={handleAcceptAsSelf}
              disabled={accepting}
            >
              {accepting ? "Accepting…" : "Accept invitation →"}
            </button>
          </div>
        )}

        {/* Valid, anonymous */}
        {!loading && valid && !isAuthenticated && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
              ✉️
            </div>
            <p className={styles.stateTitle}>You've been invited</p>
            <p className={styles.stateSub}>
              An organisation has invited you to join their Ehra workspace as
              an employee.
            </p>

            <div className={styles.orgCard}>
              <div className={styles.orgAvatar}>{initials}</div>
              <div>
                <p className={styles.orgName}>{businessName}</p>
                <p className={styles.orgLabel}>Invited organisation</p>
              </div>
            </div>

            <div className={styles.notice}>
              <span>ℹ️</span>
              <p>
                Only accept if you recognise this organisation and were
                expecting an invitation. You can decline if this was sent in
                error.
              </p>
            </div>

            <button
              className={styles.acceptBtn}
              onClick={() => navigate(`/register/${token}`)}
            >
              Accept & continue →
            </button>

            <span className={styles.declineLink} onClick={handleLoginInstead}>
              Already have an Ehra account? Log in instead
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
