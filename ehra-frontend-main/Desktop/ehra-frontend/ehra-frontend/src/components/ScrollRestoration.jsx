import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Restores browser scroll for normal document pages and preserves the
 * current position when the user refreshes or leaves the page. Dashboard
 * and EmployeeDashboard use their own internal scroll containers, so their
 * state restoration remains handled inside those pages.
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
    // Non-fatal: scroll restoration simply falls back to the top.
  }
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKeyRef = useRef("");

  useEffect(() => {
    const saveCurrentPosition = () => {
      const key = currentKeyRef.current;
      if (!key) return;
      const positions = readPositions();
      positions[key] = window.scrollY;
      writePositions(positions);
    };

    // pagehide fires for normal refresh/navigation and is more reliable
    // than waiting for a React unmount during a document unload.
    window.addEventListener("pagehide", saveCurrentPosition);
    return () => window.removeEventListener("pagehide", saveCurrentPosition);
  }, []);

  useEffect(() => {
    const key = location.pathname + location.search;
    currentKeyRef.current = key;

    if (navigationType === "POP") {
      const saved = readPositions()[key];
      if (typeof saved === "number") {
        requestAnimationFrame(() => window.scrollTo(0, saved));
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [location.pathname, location.search, navigationType]);

  return null;
}
