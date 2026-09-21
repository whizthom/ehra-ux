import { useLocation } from "react-router-dom";
import BrandSplash from "./BrandSplash";
import styles from "./RouteLoading.module.css";

/**
 * Suspense fallback for lazy-loaded route chunks (see App.jsx). Kept
 * intentionally minimal - this only ever flashes for the split second it
 * takes to fetch an already-cached JS chunk, not a real loading state.
 *
 * Customer pages are the exception: opening a business or its store shows the
 * same Ehral splash as the page's own loading state, so the hand-off from
 * "fetching the page" to "loading the business" is one continuous screen
 * instead of a spinner followed by a logo.
 */
export default function RouteLoading() {
  const { pathname } = useLocation();

  if (/^\/customer\/business\/[^/]+\/store\/?$/.test(pathname)) {
    return <BrandSplash message="Opening store…" />;
  }
  if (/^\/customer\/business\/[^/]+\/?$/.test(pathname)) {
    return <BrandSplash message="Opening business…" />;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
    </div>
  );
}
