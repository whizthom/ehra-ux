import { useNavigate } from "react-router-dom";
import styles from "./RegistrationSubmitted.module.css";

export default function RegistrationSubmitted() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.left}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>💼</div>
          <span className={styles.logoText}>Ehra</span>
        </div>

        <div className={styles.leftBody}>
          <span className={styles.tagline}>Onboarding progress</span>
          <h2 className={styles.headline}>You're almost in</h2>
          <p className={styles.desc}>
            Here's where things stand with your onboarding.
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepLine} />
              <div className={`${styles.stepDot} ${styles.stepDone}`}>✓</div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Invitation accepted</p>
                <p className={styles.stepSub}>
                  You accepted the company invite
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepLine} />
              <div className={`${styles.stepDot} ${styles.stepDone}`}>✓</div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Profile submitted</p>
                <p className={styles.stepSub}>Your details are under review</p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepLine} />
              <div className={`${styles.stepDot} ${styles.stepActive}`}>3</div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Awaiting approval</p>
                <p className={styles.stepSub}>
                  Your employer is reviewing your profile
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={`${styles.stepDot} ${styles.stepPending}`}>4</div>
              <div className={styles.stepBody}>
                <p className={styles.stepLabel}>Access granted</p>
                <p className={styles.stepSub}>
                  You'll get a notification on your dashboard
                </p>
              </div>
            </div>
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
        </div>
        <div className={styles.state}>
          <div className={styles.successRing}>
            <span className={styles.checkIcon}>✅</span>
          </div>

          <p className={styles.title}>Registration submitted!</p>
          <p className={styles.subtitle}>
            Your profile has been sent to your employer for review. You'll see a
            notification on your dashboard once your account is approved and
            ready.
          </p>

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <div className={`${styles.infoCardIcon} ${styles.iconTeal}`}>
                🔔
              </div>
              <div className={styles.infoCardText}>
                <p>Watch your dashboard</p>
                <span>
                  You'll get a notification right on your dashboard as soon as
                  you're approved — no email needed.
                </span>
              </div>
            </div>
            <div className={styles.infoCard}>
              <div className={`${styles.infoCardIcon} ${styles.iconAmber}`}>
                ⏱
              </div>
              <div className={styles.infoCardText}>
                <p>Typical review time</p>
                <span>
                  Most profiles are reviewed within 1–2 business days by your
                  employer.
                </span>
              </div>
            </div>
          </div>

          <button className={styles.homeBtn} onClick={() => navigate("/")}>
            🏠 Back to home
          </button>
          <span className={styles.helpLink}>Need help? Contact support</span>
        </div>
      </div>
    </div>
  );
}
