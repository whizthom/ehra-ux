import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { validateInvitation, acceptInvitation } from "../../api/invitationApi";
import styles from "./InvitationLanding.module.css";
import Logo from "../../components/Logo";

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

  // Separate from `valid`: this is true only when the backend actually
  // answered "no such invitation / expired / used / revoked" — as opposed
  // to the request itself failing (timeout, cold-start backend, dropped
  // connection, CORS misconfig, etc.). Collapsing both into a single
  // "invalid" state used to permanently tell a real invitee their link
  // was dead just because the server hadn't answered in time, with no way
  // to tell the two apart or retry. See loadInvitation below.
  const [loadError, setLoadError] = useState(false);

  // Authenticated-accept flow state (existing Identity — a business owner
  // picking up part-time work, or anyone already on Ehra being invited to
  // a second business). Kept separate from the anonymous /register/:token
  // flow, which creates a brand-new Identity.
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  // Purely cosmetic: validateInvitation can now legitimately take a while
  // (see its 45s timeout, sized for a cold-starting backend) — after a
  // few seconds of silence, say so, rather than leaving a bare spinner
  // that starts to look stuck or broken.
  const [slowLoad, setSlowLoad] = useState(false);

  // Pulled out of the effect so the "Try again" button can re-run the exact
  // same check without duplicating it.
  const loadInvitation = () => {
    setLoading(true);
    setLoadError(false);

    validateInvitation(token)
      .then((data) => {
        // Defensive: a token that matches no invitation at all (typo'd,
        // stale, or already deleted) makes the backend throw before it
        // ever builds an InvitationValidationDTO — GlobalExceptionHandler
        // then responds 500 with an unrelated {status, message, errors}
        // shape instead of {valid, businessName}. Coercing both fields
        // here means a malformed/unexpected response body renders as
        // "invitation unavailable" instead of crashing the whole page
        // (see the unguarded `initials` bug this replaced).
        setValid(Boolean(data?.valid));
        setBusinessName(
          typeof data?.businessName === "string" ? data.businessName : "",
        );
      })
      .catch((err) => {
        // A real answer from the backend ("no such invitation", expired,
        // used, revoked) always comes back as a normal 200 with
        // {valid: false} from InvitationServiceImpl.validateInvitation —
        // that path is handled above and never lands here. Anything that
        // throws is the REQUEST itself failing: no response at all
        // (dropped connection, DNS hiccup, a sleeping backend that hasn't
        // finished waking up within the request timeout — see the Render
        // free-tier cold-start note in authApi.js), a genuine 5xx, or a
        // CORS misconfiguration. None of those mean the invitation is
        // invalid, so this must not be reported as "invitation
        // unavailable" — that told real invitees with perfectly good
        // links that their invite was dead.
        setValid(false);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const initials = (businessName || "")
    .split(" ")
    .filter(Boolean)
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
        typeof msg === "string"
          ? msg
          : "Couldn't accept this invitation. Please try again.",
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
        <div className={styles.logoRow} style={{ "--text-primary": "#ffffff" }}>
          <Logo variant="horizontal" size={80} />
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
        <div
          className={styles.mobileLogoRow}
          style={{ "--text-primary": "#0b1f1a" }}
        >
          <Logo variant="horizontal" size={56} />
        </div>

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

        {/* Couldn't reach the server — NOT the same as a dead invitation.
            Distinct from the branch below so a cold-starting backend or a
            dropped connection never gets reported to a real invitee as
            "this link is invalid." */}
        {!loading && !valid && loadError && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconDanger}`}>📡</div>
            <p className={styles.stateTitle}>Couldn't check this invitation</p>
            <p className={styles.stateSub}>
              We couldn't reach the server just now — this doesn't mean your
              invitation is invalid. Please check your connection and try again.
            </p>
            <button className={styles.acceptBtn} onClick={loadInvitation}>
              Try again →
            </button>
          </div>
        )}

        {/* Backend genuinely answered "not valid": no such token, or it's
            expired / used / revoked. */}
        {!loading && !valid && !loadError && (
          <div className={styles.state}>
            <div className={`${styles.iconWrap} ${styles.iconDanger}`}>🔗</div>
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
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>✅</div>
            <p className={styles.stateTitle}>
              Invitation accepted
              <span className={styles.stateTitleAccent} aria-hidden="true" />
            </p>
            <p className={styles.stateSub}>
              {businessName} still needs to approve your membership. Once
              approved, this workspace will appear under My Accounts and you can
              switch into it any time.
            </p>
            <button
              className={styles.acceptBtn}
              onClick={() =>
                navigate(
                  user?.contextType === "EMPLOYEE"
                    ? "/my-dashboard"
                    : "/dashboard",
                )
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
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>✉️</div>
            <p className={styles.stateTitle}>
              You've been invited
              <span className={styles.stateTitleAccent} aria-hidden="true" />
            </p>
            <p className={styles.stateSub}>
              {businessName} has invited you to join as an employee. You're
              already signed in to Ehra — accept below to add this workspace to
              your account.
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
                This adds a new workspace to your existing account — your other
                businesses stay exactly as they are.
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
            <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>✉️</div>
            <p className={styles.stateTitle}>
              You've been invited
              <span className={styles.stateTitleAccent} aria-hidden="true" />
            </p>
            <p className={styles.stateSub}>
              An organisation has invited you to join their Ehra workspace as an
              employee.
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

            <div className={styles.orDivider}>or</div>

            <button
              className={styles.secondaryBtn}
              onClick={handleLoginInstead}
            >
              Already have an Ehra account? Log in instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
