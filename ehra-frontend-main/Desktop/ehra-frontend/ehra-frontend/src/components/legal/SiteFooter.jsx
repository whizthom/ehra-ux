import { Link } from "react-router-dom";
import Logo from "../Logo";
import styles from "./SiteFooter.module.css";

// Mirrors About.jsx's FOOTER_LINKS, but as real paths back to /about's
// sections (About.jsx's own footer uses bare #anchors, which only work
// when you're already on that page — this footer can be reached from
// anywhere, so Company/Platform links route to /about first).
const FOOTER_LINKS = {
  Platform: [
    { label: "Employees", href: "/about#workforce" },
    { label: "Attendance", href: "/about#platform" },
    { label: "Leave", href: "/about#workforce" },
    { label: "Branches", href: "/about#business" },
  ],
  Company: [
    { label: "About", href: "/about#story" },
    { label: "Vision", href: "/about#vision" },
    { label: "Founder", href: "/about#founder" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          <Logo variant="horizontal" size={36} tone="sidebar" />
          <p>
            Powerful enough for where you're going. Simple enough for where you
            are.
          </p>
        </div>
        <div className={styles.footerCols}>
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div className={styles.footerCol} key={heading}>
              <span className={styles.footerColHeading}>{heading}</span>
              {links.map((link) => (
                <Link key={link.label} to={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className={styles.footerCol}>
            <span className={styles.footerColHeading}>Contact</span>
            <a
              href="mailto:contact@ehralsystems"
              className={styles.footerContactLink}
            >
              <i className="ti ti-mail" aria-hidden="true" />
              contact@ehral.com
            </a>
            <a href="tel:+2349077746757" className={styles.footerContactLink}>
              <i className="ti ti-phone" aria-hidden="true" />
              0907 774 6757
            </a>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© 2026 Ehral Systems. All rights reserved.</span>
        <span className={styles.footerTagline}>Built for Ambition</span>
      </div>
    </footer>
  );
}
