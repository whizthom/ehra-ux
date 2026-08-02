import styles from "./RouteLoading.module.css";

/**
 * Suspense fallback for lazy-loaded route chunks (see App.jsx). Kept
 * intentionally minimal — this only ever flashes for the split second it
 * takes to fetch an already-cached JS chunk, not a real loading state.
 */
export default function RouteLoading() {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
    </div>
  );
}
