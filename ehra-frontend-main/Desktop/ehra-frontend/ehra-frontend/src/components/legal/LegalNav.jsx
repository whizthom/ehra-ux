import { Link } from "react-router-dom";
import Logo from "../Logo";
import styles from "./LegalNav.module.css";

/**
 * Slim, always-solid top bar for standalone legal documents (Terms,
 * Privacy). Deliberately simpler than the marketing nav on About.jsx —
 * no transparent-over-hero state, no in-page section links — since a
 * legal document isn't a scrolling story, it's a reference someone
 * lands on directly and wants to read or leave quickly.
 */
export default function LegalNav() {
  return (
    <header className={styles.nav}>
      <Link to="/about" className={styles.brand} aria-label="Ehral home">
        <Logo variant="horizontal" size={32} />
      </Link>

      <div className={styles.actions}>
        <Link to="/about" className={styles.backLink}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>Back to Ehral</span>
        </Link>
        <Link to="/login" className={styles.signIn}>
          Sign in
        </Link>
        <Link to="/" className={styles.cta}>
          Get started
        </Link>
      </div>
    </header>
  );
}
