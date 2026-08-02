import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./NotFound.module.css";

/**
 * Catch-all for any URL that doesn't match a route (typo'd link, stale
 * bookmark, a deep link to something removed, etc.). Without this,
 * react-router v7's <Routes> renders nothing at all for an unmatched
 * path — a blank white screen with no way back, which is exactly the
 * "no route should produce a blank page" bug this project asked to be
 * rid of. Sits as the last <Route path="*"> in App.jsx.
 */
export default function NotFound() {
  const { isAuthenticated, user } = useAuth();

  const homeHref = !isAuthenticated
    ? "/login"
    : user?.role === "ROLE_EMPLOYEE"
      ? "/my-dashboard"
      : "/dashboard";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge}>
          <i className="ti ti-map-pin-off" />
        </div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.subtitle}>
          The page you're looking for doesn't exist, or the link may be out of
          date.
        </p>
        <Link to={homeHref} className={styles.button}>
          Take me back
        </Link>
      </div>
    </div>
  );
}
