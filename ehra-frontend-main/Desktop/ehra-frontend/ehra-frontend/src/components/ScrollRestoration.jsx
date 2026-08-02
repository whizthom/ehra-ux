import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * React Router (unlike Next.js or a classic multi-page app) does nothing
 * about scroll position by default: navigating from a scrolled-down list
 * to a new page leaves the new page scrolled down too, and clicking
 * Back doesn't restore where you were. This fixes both halves:
 *
 * - PUSH/REPLACE (clicked a link, called navigate()) → scroll to top of
 *   the new page, like a fresh document load.
 * - POP (browser Back/Forward, including swipe-back gestures on mobile
 *   and PWA hardware/gesture back) → restore the scroll position that
 *   page had before we left it, using sessionStorage keyed by the full
 *   path so it survives across a refresh too.
 *
 * Note: pages that lock body scroll and manage their own internal
 * scroll container (Dashboard, EmployeeDashboard — see the
 * `app-shell-lock` convention in index.css) aren't affected by this,
 * since `window.scrollTo` is a no-op when the body itself doesn't
 * scroll. Nothing else needs to change for those.
 */
const STORAGE_KEY = "ehral:scrollPositions";

function readPositions() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePositions(positions) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sessionStorage full/unavailable (private browsing edge cases) —
    // scroll restoration degrades to "always top", which is fine.
  }
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastKey = useRef(null);

  // Save the outgoing page's scroll position just before it unmounts.
  useEffect(() => {
    const key = lastKey.current;
    return () => {
      if (!key) return;
      const positions = readPositions();
      positions[key] = window.scrollY;
      writePositions(positions);
    };
  }, [location.key]);

  useEffect(() => {
    const key = location.pathname + location.search;
    lastKey.current = key;

    if (navigationType === "POP") {
      const positions = readPositions();
      const saved = positions[key];
      if (typeof saved === "number") {
        window.scrollTo(0, saved);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.search, navigationType]);

  return null;
}
