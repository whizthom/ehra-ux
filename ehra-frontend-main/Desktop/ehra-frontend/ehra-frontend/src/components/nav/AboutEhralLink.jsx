import { Link } from "react-router-dom";
import styles from "./AboutEhralLink.module.css";

/**
 * "About Ehral" entry point — intentionally only ever rendered on Login,
 * Register and EmployeeRegistration (the public/register surfaces). It is
 * NOT part of App.jsx's global chrome, so every other route (dashboards,
 * invitation flow, QR display, pricing, etc.) is unaffected by design —
 * see each of those three pages' render for the single <AboutEhralLink />
 * usage.
 *
 * `tone="dark"` (default) is for use over the dark brand panel (Login/
 * Register/EmployeeRegistration's `.left`); `tone="light"` is for the
 * light-background mobile header that replaces that panel under ~900px.
 */
export default function AboutEhralLink({ tone = "dark", className = "" }) {
  return (
    <Link
      to="/about"
      className={`${styles.link} ${tone === "light" ? styles.light : styles.dark} ${className}`}
    >
      <span>About Ehral</span>
      <i className="ti ti-arrow-up-right" aria-hidden="true" />
    </Link>
  );
}
